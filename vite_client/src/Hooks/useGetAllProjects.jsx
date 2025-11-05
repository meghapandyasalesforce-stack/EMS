import { setAllProjects } from '../context/projectSlice'
import axios from '../utils/axios'
import { useEffect,useState } from 'react'
import { useDispatch } from 'react-redux'
import { ADMIN_PROJECT_ENDPOINT } from './../utils/constant';

const useGetAllProjects = () => {
    const dispatch = useDispatch();
 


    useEffect(() => {
        const fetchAllProjects = async () => {
             // Removed console.log for production
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
                    // Removed console.error for production
                    dispatch(setAllProjects([]));
                }

            } catch (error) {
                // Removed console.error for production
                // Removed console.error for production
                dispatch(setAllProjects([]));
            }
        };

        fetchAllProjects();
    }, [dispatch]);
    
};

export default useGetAllProjects;
