import React, { useState } from 'react';
import { format } from 'date-fns';
import { FaStar, FaPlus, FaTimes, FaPaperPlane, FaEdit, FaCheckCircle } from 'react-icons/fa';

export const EMPTY_INTERVIEW_FEEDBACK = {
    rating: '',
    technical: '',
    communication: '',
    behaviour: '',
    recommendation: 'Hire',
    comments: '',
    strengths: [],
    weaknesses: [],
};

function ratingToStars(rating) {
    const n = Number(rating);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.min(5, Math.max(1, Math.round(n > 5 ? n / 2 : n)));
}

function scorePct(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.min(100, Math.max(0, (n / 10) * 100));
}

function TagField({ label, tags = [], onChange, placeholder, variant = 'strength' }) {
    const [draft, setDraft] = useState('');

    const add = () => {
        const next = draft.trim();
        if (!next) return;
        if (tags.some((t) => t.toLowerCase() === next.toLowerCase())) {
            setDraft('');
            return;
        }
        onChange([...tags, next]);
        setDraft('');
    };

    const remove = (idx) => {
        onChange(tags.filter((_, i) => i !== idx));
    };

    return (
        <div className="ats-feedback-tags">
            <label className="ats-feedback-label">{label}</label>
            <div className="ats-feedback-tags__list">
                {tags.map((tag, idx) => (
                    <span key={`${tag}-${idx}`} className={`ats-feedback-chip ats-feedback-chip--${variant}`}>
                        {tag}
                        <button type="button" aria-label={`Remove ${tag}`} onClick={() => remove(idx)}>
                            <FaTimes />
                        </button>
                    </span>
                ))}
            </div>
            <div className="ats-feedback-tags__add">
                <input
                    type="text"
                    className="cm-input"
                    placeholder={placeholder}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            add();
                        }
                    }}
                />
                <button type="button" className="ats-feedback-add-btn" aria-label={`Add ${label}`} onClick={add}>
                    <FaPlus />
                </button>
            </div>
        </div>
    );
}

function ScoreSlider({ label, value, onChange }) {
    const n = Number(value);
    const safe = Number.isFinite(n) ? Math.min(10, Math.max(0, n)) : 0;
    return (
        <div className="ats-feedback-slider">
            <div className="ats-feedback-slider__head">
                <span>{label}</span>
                <strong>{safe}/10</strong>
            </div>
            <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={safe}
                onChange={(e) => onChange(e.target.value)}
                style={{ '--ats-slider-pct': `${(safe / 10) * 100}%` }}
            />
        </div>
    );
}

/** Read-only feedback card — same visual language as the entry form (Admin/HR + interviewer). */
export function InterviewFeedbackReadonly({
    feedback,
    interviewerName,
    className = '',
}) {
    if (!feedback) return null;
    const stars = ratingToStars(feedback.rating);
    const scores = [
        { label: 'Technical', value: feedback.technical },
        { label: 'Communication', value: feedback.communication },
        { label: 'Behaviour', value: feedback.behaviour },
    ];

    return (
        <div className={`ats-feedback-readonly ${className}`.trim()}>
            <div className="ats-feedback-readonly__header">
                <FaCheckCircle aria-hidden />
                <div className="min-w-0">
                    <h3>Interview Feedback</h3>
                    {interviewerName ? (
                        <p className="ats-feedback-readonly__sub">Interviewer: {interviewerName}</p>
                    ) : null}
                </div>
                {feedback.recommendation ? (
                    <span className="ats-pill ats-pill--pending">{feedback.recommendation}</span>
                ) : null}
            </div>

            <div className="ats-feedback-block">
                <span className="ats-feedback-label">Overall Rating</span>
                <div className="ats-feedback-stars ats-feedback-stars--readonly" aria-label={`Overall ${feedback.rating ?? '—'}/10`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                        <span key={n} className={n <= stars ? 'is-active' : ''} aria-hidden>
                            <FaStar />
                        </span>
                    ))}
                    {feedback.rating != null ? (
                        <span className="ats-feedback-readonly__score-text">{feedback.rating}/10</span>
                    ) : null}
                </div>
            </div>

            <div className="ats-feedback-sliders ats-feedback-sliders--readonly">
                {scores.map((s) => (
                    <div key={s.label} className="ats-feedback-slider">
                        <div className="ats-feedback-slider__head">
                            <span>{s.label}</span>
                            <strong>{s.value != null ? `${s.value}/10` : '—'}</strong>
                        </div>
                        <div
                            className="ats-feedback-bar"
                            style={{ '--ats-slider-pct': `${scorePct(s.value)}%` }}
                            role="presentation"
                        />
                    </div>
                ))}
            </div>

            {feedback.comments ? (
                <div className="ats-feedback-block">
                    <span className="ats-feedback-label">Detailed Comments</span>
                    <p className="ats-feedback-readonly__comments">{feedback.comments}</p>
                </div>
            ) : null}

            {(feedback.strengths?.length > 0 || feedback.weaknesses?.length > 0) && (
                <div className="ats-feedback-columns">
                    <div className="ats-feedback-tags">
                        <span className="ats-feedback-label">Strengths</span>
                        <div className="ats-feedback-tags__list">
                            {(feedback.strengths || []).map((s) => (
                                <span key={`s-${s}`} className="ats-feedback-chip ats-feedback-chip--strength">{s}</span>
                            ))}
                            {!feedback.strengths?.length ? (
                                <span className="ats-feedback-readonly__empty">—</span>
                            ) : null}
                        </div>
                    </div>
                    <div className="ats-feedback-tags">
                        <span className="ats-feedback-label">Areas for Improvement</span>
                        <div className="ats-feedback-tags__list">
                            {(feedback.weaknesses || []).map((w) => (
                                <span key={`w-${w}`} className="ats-feedback-chip ats-feedback-chip--improve">{w}</span>
                            ))}
                            {!feedback.weaknesses?.length ? (
                                <span className="ats-feedback-readonly__empty">—</span>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}

            {feedback.submittedAt ? (
                <p className="ats-feedback-readonly__meta">
                    Submitted {format(new Date(feedback.submittedAt), 'dd MMM yyyy, h:mm a')}
                </p>
            ) : null}
        </div>
    );
}

/**
 * Visual-only redesign of interview feedback entry.
 * Same fields the API already accepts: rating, technical, communication,
 * behaviour, recommendation, comments, strengths, weaknesses.
 */
export default function InterviewFeedbackForm({
    value,
    onChange,
    onSubmit,
    onSaveDraft,
    onCancel,
    busy = false,
    submitLabel = 'Submit Feedback',
    showHeader = true,
    className = '',
}) {
    const form = { ...EMPTY_INTERVIEW_FEEDBACK, ...value };
    const stars = ratingToStars(form.rating);

    const patch = (partial) => onChange({ ...form, ...partial });

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit?.(form);
    };

    return (
        <form className={`ats-feedback-form ${className}`.trim()} onSubmit={handleSubmit}>
            {showHeader ? (
                <div className="ats-feedback-form__header">
                    <FaEdit className="ats-feedback-form__header-icon" aria-hidden />
                    <h3>Provide Feedback</h3>
                </div>
            ) : null}

            <div className="ats-feedback-block">
                <label className="ats-feedback-label">Overall Rating</label>
                <div className="ats-feedback-stars" role="group" aria-label="Overall rating">
                    {[1, 2, 3, 4, 5].map((n) => (
                        <button
                            key={n}
                            type="button"
                            className={n <= stars ? 'is-active' : ''}
                            aria-label={`${n} star${n > 1 ? 's' : ''}`}
                            aria-pressed={n <= stars}
                            onClick={() => patch({ rating: String(n * 2) })}
                        >
                            <FaStar />
                        </button>
                    ))}
                </div>
            </div>

            <div className="ats-feedback-sliders">
                <ScoreSlider
                    label="Technical Score"
                    value={form.technical}
                    onChange={(technical) => patch({ technical })}
                />
                <ScoreSlider
                    label="Communication"
                    value={form.communication}
                    onChange={(communication) => patch({ communication })}
                />
                <ScoreSlider
                    label="Behaviour"
                    value={form.behaviour}
                    onChange={(behaviour) => patch({ behaviour })}
                />
            </div>

            <div className="ats-feedback-block">
                <label className="ats-feedback-label" htmlFor="ats-feedback-comments">Detailed Comments</label>
                <textarea
                    id="ats-feedback-comments"
                    rows={4}
                    className="cm-input ats-feedback-comments w-full"
                    placeholder="Provide context for your scores..."
                    value={form.comments}
                    onChange={(e) => patch({ comments: e.target.value })}
                />
            </div>

            <div className="ats-feedback-columns">
                <TagField
                    label="Strengths"
                    tags={form.strengths || []}
                    onChange={(strengths) => patch({ strengths })}
                    placeholder="Add strength..."
                    variant="strength"
                />
                <TagField
                    label="Areas for Improvement"
                    tags={form.weaknesses || []}
                    onChange={(weaknesses) => patch({ weaknesses })}
                    placeholder="Add area..."
                    variant="improve"
                />
            </div>

            <div className="ats-feedback-block">
                <label className="ats-feedback-label" htmlFor="ats-feedback-recommendation">Final Recommendation</label>
                <select
                    id="ats-feedback-recommendation"
                    className="cm-select w-full"
                    value={form.recommendation || 'Hire'}
                    onChange={(e) => patch({ recommendation: e.target.value })}
                >
                    <option value="" disabled>Select recommendation...</option>
                    {['Strong Hire', 'Hire', 'Maybe', 'No Hire'].map((r) => (
                        <option key={r} value={r}>{r}</option>
                    ))}
                </select>
            </div>

            <div className="ats-feedback-actions">
                {onCancel ? (
                    <button type="button" className="ats-feedback-btn-text" disabled={busy} onClick={onCancel}>
                        Cancel
                    </button>
                ) : null}
                {onSaveDraft ? (
                    <button
                        type="button"
                        className="ats-feedback-btn-text"
                        disabled={busy}
                        onClick={() => onSaveDraft(form)}
                    >
                        Save Draft
                    </button>
                ) : null}
                <button type="submit" className="ats-feedback-btn-submit" disabled={busy}>
                    {submitLabel}
                    <FaPaperPlane aria-hidden />
                </button>
            </div>
        </form>
    );
}
