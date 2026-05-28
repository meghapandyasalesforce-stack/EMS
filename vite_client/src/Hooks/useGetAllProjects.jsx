import { setAllProjects } from '../context/projectSlice'
import axios from '../utils/axios'
import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { ADMIN_PROJECT_ENDPOINT } from './../utils/constant';

const PAGE_LIMIT = 100;

function extractProjectsPage(res) {
    if (res.data?.success && Array.isArray(res.data.data)) {
        return res.data.data.flat();
    }
    if (res.data?.success && Array.isArray(res.data.projects)) {
        return res.data.projects.flat();
    }
    if (Array.isArray(res.data)) {
        return res.data.flat();
    }
    return [];
}

const useGetAllProjects = () => {
    const dispatch = useDispatch();

    useEffect(() => {
        const fetchAllProjects = async () => {
            try {
                const aggregated = [];
                let page = 1;
                let hasNext = true;

                while (hasNext) {
                    const res = await axios.get(`${ADMIN_PROJECT_ENDPOINT}/get-all-project`, {
                        params: { page, limit: PAGE_LIMIT },
                    });

                    const chunk = extractProjectsPage(res);
                    aggregated.push(...chunk);

                    const pagination = res.data?.pagination;
                    if (pagination && typeof pagination.hasNext === 'boolean') {
                        hasNext = pagination.hasNext;
                        page += 1;
                    } else {
                        hasNext = chunk.length >= PAGE_LIMIT;
                        page += 1;
                    }

                    if (!res.data?.success && chunk.length === 0) {
                        break;
                    }
                }

                dispatch(setAllProjects(aggregated));
            } catch {
                dispatch(setAllProjects([]));
            }
        };

        fetchAllProjects();
    }, [dispatch]);
};

export default useGetAllProjects;
