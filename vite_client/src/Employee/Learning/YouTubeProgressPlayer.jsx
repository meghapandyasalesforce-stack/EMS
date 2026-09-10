import React, { useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 3000;

let apiLoader = null;

/**
 * Loads the official YouTube IFrame API once per page. The video keeps playing from
 * YouTube's own player, we only read playback position from it.
 */
const loadYouTubeApi = () => {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (apiLoader) return apiLoader;

    apiLoader = new Promise((resolve) => {
        const previousCallback = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            if (typeof previousCallback === 'function') previousCallback();
            resolve(window.YT);
        };

        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        document.head.appendChild(script);
    });

    return apiLoader;
};

const ITEM_COMPLETE_PERCENT = 95;

/** Where the learner currently is: which playlist item, and how far into it. */
const readPlaybackSnapshot = (player) => {
    const duration = player.getDuration?.() || 0;
    if (!duration) return null;

    const currentTime = player.getCurrentTime?.() || 0;
    const playlist = player.getPlaylist?.();
    const totalItems = Array.isArray(playlist) && playlist.length > 0 ? playlist.length : 1;
    const index = totalItems > 1 ? (player.getPlaylistIndex?.() ?? 0) : 0;

    return {
        index,
        totalItems,
        videoId:
            player.getVideoData?.()?.video_id ||
            (Array.isArray(playlist) ? playlist[index] : null),
        percent: Math.max(0, Math.min(100, Math.round((currentTime / duration) * 100)))
    };
};

/** Overall progress is the average across every playlist item, so skipped ones count as zero. */
const overallPercentFrom = (watchedByIndex, totalItems) => {
    const watchedTotal = [...watchedByIndex.values()].reduce((sum, value) => sum + value, 0);
    return Math.max(0, Math.min(100, Math.round(watchedTotal / Math.max(totalItems, 1))));
};

/**
 * A playlist plays most reliably when it is anchored to a starting video. Only fall back
 * to the bare `listType` form when the URL carried no video id at all.
 */
const buildPlayerConfig = ({ videoId, playlistId }) => {
    const playerVars = {
        rel: 0,
        playsinline: 1,
        origin: window.location.origin
    };

    if (playlistId) {
        playerVars.list = playlistId;
        if (!videoId) playerVars.listType = 'playlist';
    }

    const config = { width: '100%', height: '100%', playerVars };
    if (videoId) config.videoId = videoId;
    return config;
};

const YouTubeProgressPlayer = ({ videoId, playlistId, watchedItems, onProgress, onComplete }) => {
    const containerRef = useRef(null);
    const playerRef = useRef(null);
    const pollRef = useRef(null);
    const onProgressRef = useRef(onProgress);
    const onCompleteRef = useRef(onComplete);
    const watchedRef = useRef(new Map());
    const [loadError, setLoadError] = useState(null);
    const [playlistLength, setPlaylistLength] = useState(0);
    const [activeIndex, setActiveIndex] = useState(0);
    const [watchedByIndex, setWatchedByIndex] = useState({});

    onProgressRef.current = onProgress;
    onCompleteRef.current = onComplete;

    // Restore what was already watched in earlier sessions so nothing is re-credited or lost.
    useEffect(() => {
        const restored = new Map(
            (watchedItems || [])
                .filter((item) => Number.isFinite(Number(item?.index)))
                .map((item) => [Number(item.index), Math.max(0, Math.min(100, Number(item.percent) || 0))])
        );
        watchedRef.current = restored;
        setWatchedByIndex(Object.fromEntries(restored));
    }, [watchedItems]);

    useEffect(() => {
        if (!videoId && !playlistId) return undefined;

        let cancelled = false;
        setLoadError(null);
        setPlaylistLength(0);
        setActiveIndex(0);

        const stopPolling = () => {
            if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
        };

        const reportProgress = (options) => {
            const player = playerRef.current;
            if (!player) return;

            const snapshot = readPlaybackSnapshot(player);
            if (!snapshot) return;

            const previous = watchedRef.current.get(snapshot.index) || 0;
            if (snapshot.percent > previous) {
                watchedRef.current.set(snapshot.index, snapshot.percent);
                setWatchedByIndex(Object.fromEntries(watchedRef.current));
            }

            onProgressRef.current?.(overallPercentFrom(watchedRef.current, snapshot.totalItems), {
                ...options,
                item: {
                    index: snapshot.index,
                    videoId: snapshot.videoId,
                    percent: Math.max(previous, snapshot.percent),
                    totalItems: snapshot.totalItems
                }
            });
        };

        loadYouTubeApi().then((YT) => {
            if (cancelled || !containerRef.current) return;

            // The API swaps this node for an iframe, so keep it outside React's control.
            const mountNode = document.createElement('div');
            containerRef.current.appendChild(mountNode);

            const syncPlaylistState = () => {
                const player = playerRef.current;
                const playlist = player?.getPlaylist?.();
                if (Array.isArray(playlist)) setPlaylistLength(playlist.length);
                setActiveIndex(player?.getPlaylistIndex?.() ?? 0);
            };

            playerRef.current = new YT.Player(mountNode, {
                ...buildPlayerConfig({ videoId, playlistId }),
                events: {
                    onReady: syncPlaylistState,
                    onError: (event) => {
                        const player = playerRef.current;
                        const playlist = player?.getPlaylist?.();
                        const hasNext =
                            Array.isArray(playlist) &&
                            (player?.getPlaylistIndex?.() ?? 0) < playlist.length - 1;

                        // 101 / 150 mean the owner blocked embedding for that single video.
                        if (hasNext && (event?.data === 101 || event?.data === 150)) {
                            setLoadError(
                                'One video in this playlist cannot be embedded, so it was skipped. Open it on YouTube to watch that one.'
                            );
                            player.nextVideo?.();
                            return;
                        }

                        setLoadError(
                            event?.data === 100
                                ? 'This video is private or no longer available on YouTube.'
                                : 'YouTube will not allow this to play here. Open it on YouTube instead.'
                        );
                    },
                    onStateChange: (event) => {
                        syncPlaylistState();

                        if (event.data === YT.PlayerState.PLAYING) {
                            stopPolling();
                            pollRef.current = setInterval(reportProgress, POLL_INTERVAL_MS);
                            return;
                        }

                        // Persist the latest position whenever playback settles.
                        stopPolling();
                        reportProgress({ flush: true });

                        if (event.data === YT.PlayerState.ENDED) {
                            const player = playerRef.current;
                            const playlist = player?.getPlaylist?.();

                            // While a playlist is still loading its items we cannot judge, so wait.
                            if (playlistId && !Array.isArray(playlist)) return;

                            if (!Array.isArray(playlist) || playlist.length <= 1) {
                                onCompleteRef.current?.();
                                return;
                            }

                            // Every video has to be watched — reaching the end of the last one
                            // after skipping others does not complete the course.
                            const allWatched = playlist.every(
                                (_, index) =>
                                    (watchedRef.current.get(index) || 0) >= ITEM_COMPLETE_PERCENT
                            );
                            if (allWatched) onCompleteRef.current?.();
                        }
                    }
                }
            });
        });

        const container = containerRef.current;

        return () => {
            cancelled = true;
            stopPolling();
            const player = playerRef.current;
            playerRef.current = null;
            if (player) {
                const snapshot = readPlaybackSnapshot(player);
                if (snapshot) {
                    const watched = Math.max(
                        watchedRef.current.get(snapshot.index) || 0,
                        snapshot.percent
                    );
                    watchedRef.current.set(snapshot.index, watched);
                    onProgressRef.current?.(
                        overallPercentFrom(watchedRef.current, snapshot.totalItems),
                        {
                            flush: true,
                            item: {
                                index: snapshot.index,
                                videoId: snapshot.videoId,
                                percent: watched,
                                totalItems: snapshot.totalItems
                            }
                        }
                    );
                }
                player.destroy?.();
            }
            if (container) container.replaceChildren();
        };
    }, [videoId, playlistId]);

    if (!videoId && !playlistId) return null;

    const playAt = (index) => {
        const player = playerRef.current;
        if (!player?.playVideoAt) return;
        player.playVideoAt(index);
        setActiveIndex(index);
    };

    return (
        <div>
            <div ref={containerRef} className="aspect-video w-full overflow-hidden rounded-xl bg-black" />

            {playlistLength > 1 && (
                <div className="mt-3 rounded-xl border border-slate-100 bg-white p-3">
                    <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-semibold text-slate-700">
                            Video {activeIndex + 1} of {playlistLength}
                        </p>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => playAt(Math.max(activeIndex - 1, 0))}
                                disabled={activeIndex === 0}
                                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40"
                            >
                                Previous
                            </button>
                            <button
                                type="button"
                                onClick={() => playAt(Math.min(activeIndex + 1, playlistLength - 1))}
                                disabled={activeIndex >= playlistLength - 1}
                                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {Array.from({ length: playlistLength }, (_, index) => {
                            const watched = watchedByIndex[index] || 0;
                            const isWatched = watched >= ITEM_COMPLETE_PERCENT;
                            const isStarted = watched > 0 && !isWatched;
                            return (
                                <button
                                    key={index}
                                    type="button"
                                    onClick={() => playAt(index)}
                                    title={
                                        isWatched
                                            ? `Video ${index + 1}: watched`
                                            : isStarted
                                              ? `Video ${index + 1}: ${watched}% watched`
                                              : `Video ${index + 1}: not watched`
                                    }
                                    className={`h-7 w-7 rounded-full text-xs font-semibold transition ${
                                        index === activeIndex
                                            ? 'bg-[#20C997] text-white'
                                            : isWatched
                                              ? 'bg-emerald-100 text-emerald-700'
                                              : isStarted
                                                ? 'bg-amber-100 text-amber-700'
                                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                    }`}
                                >
                                    {index + 1}
                                </button>
                            );
                        })}
                    </div>
                    <p className="mt-2 text-[11px] text-slate-400">
                        Green means watched, amber means partly watched, grey means not watched yet.
                        Skipped videos are not counted towards your progress.
                    </p>
                </div>
            )}

            {loadError && <p className="mt-2 text-xs font-medium text-red-600">{loadError}</p>}
        </div>
    );
};

export default React.memo(YouTubeProgressPlayer);
