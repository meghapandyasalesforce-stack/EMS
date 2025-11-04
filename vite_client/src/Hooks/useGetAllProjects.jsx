import { setAllProjects } from '../context/projectSlice'
import axios from '../utils/axios'
import { useEffect,useState } from 'react'
import { useDispatch } from 'react-redux'
import { ADMIN_PROJECT_ENDPOINT } from './../utils/constant';

const useGetAllProjects = () => {
    const dispatch = useDispatch();
 


    useEffect(() => {
        const fetchAllProjects = async () => {
             console.log("Fetching projects..."); // ✅ Add this
            try {
                const res = await axios.get(`${ADMIN_PROJECT_ENDPOINT}/get-all-project`);

                if (res.data.success && Array.isArray(res.data.projects)) {
                    const flatProjects = res.data.projects.flat(); // Flatten nested array
                    dispatch(setAllProjects(flatProjects));
                } else if (Array.isArray(res.data)) {
                    // Handle case where response is directly an array
                    dispatch(setAllProjects(res.data));
                } else if (res.data.data && Array.isArray(res.data.data)) {
                    dispatch(setAllProjects(res.data.data));
                } else {
                    console.error("Unexpected structure:", res.data);
                    dispatch(setAllProjects([]));
                }

            } catch (error) {
                console.error("Failed to fetch projects:", error);
                if (error.response?.status === 403) {
                    console.error('403 Forbidden - Admin role required. Please log out and log back in.');
                }
                dispatch(setAllProjects([]));
            }
        };

        fetchAllProjects();
    }, [dispatch]);
    
};

export default useGetAllProjects;
