import { useState, useEffect } from "react";
import toastError from "../../errors/toastError";
import projectsService from "../../services/projectsService";

const useProjects = ({ searchParam, pageNumber, refreshSignal = 0 }) => {
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(false);
    const [projects, setProjects] = useState([]);
    const [count, setCount] = useState(0);

    useEffect(() => {
        setLoading(true);
        const delayDebounceFn = setTimeout(() => {
            const fetchProjects = async () => {
                try {
                    const data = await projectsService.getProjects({
                        searchParam,
                        pageNumber,
                    });
                    setProjects(data.projects || []);
                    setHasMore(data.hasMore);
                    setCount(data.count);
                    setLoading(false);
                } catch (err) {
                    setLoading(false);
                    toastError(err);
                }
            };

            fetchProjects();
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [searchParam, pageNumber, refreshSignal]);

    return { projects, loading, hasMore, count };
};

export default useProjects;
