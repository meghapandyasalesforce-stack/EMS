import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaPlus, FaTrash, FaSave } from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { toast } from 'react-toastify';
import CourseFormShell from './CourseFormShell';
import { MINT_GRADIENT } from '../Reports/constants';

const EditCourse = () => {
    const { courseId } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: 'Technical',
        level: 'Beginner',
        duration: 0,
        status: 'Draft',
        content: []
    });
    const [newModule, setNewModule] = useState({
        moduleTitle: '',
        moduleDescription: '',
        contentType: 'Video',
        contentUrl: '',
        duration: 0,
        isRequired: true
    });

    useEffect(() => {
        const fetchCourse = async () => {
            try {
                setLoading(true);
                const res = await axios.get(`/v1/admin/learning/courses/${courseId}`, { withCredentials: true });
                const course = res.data?.data;
                if (!course) {
                    toast.error('Course not found');
                    navigate('/learning');
                    return;
                }
                setFormData({
                    title: course.title || '',
                    description: course.description || '',
                    category: course.category || 'Technical',
                    level: course.level || 'Beginner',
                    duration: Number(course.duration || 0),
                    status: course.status || 'Draft',
                    content: Array.isArray(course.content) ? course.content : []
                });
            } catch (error) {
                toast.error(error.response?.data?.message || 'Failed to load course');
                navigate('/learning');
            } finally {
                setLoading(false);
            }
        };
        fetchCourse();
    }, [courseId, navigate]);

    const handleInputChange = (e) => {
        const { name, value, type } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) || 0 : value
        }));
    };

    const handleModuleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setNewModule((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : (type === 'number' ? parseFloat(value) || 0 : value)
        }));
    };

    const addModule = () => {
        if (!newModule.moduleTitle.trim()) {
            toast.error('Module title is required');
            return;
        }
        const module = {
            ...newModule,
            order: formData.content.length + 1
        };
        setFormData((prev) => ({ ...prev, content: [...prev.content, module] }));
        setNewModule({
            moduleTitle: '',
            moduleDescription: '',
            contentType: 'Video',
            contentUrl: '',
            duration: 0,
            isRequired: true
        });
    };

    const removeModule = (index) => {
        setFormData((prev) => ({
            ...prev,
            content: prev.content
                .filter((_, i) => i !== index)
                .map((m, i) => ({ ...m, order: i + 1 }))
        }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            await axios.put(
                `/v1/admin/learning/courses/${courseId}`,
                {
                    ...formData,
                    duration: Number(formData.duration || 0),
                    content: formData.content.map((module, idx) => ({
                        ...module,
                        order: idx + 1
                    }))
                },
                { withCredentials: true }
            );
            toast.success('Course updated successfully');
            navigate('/learning');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update course');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <LoadingSpinner message="Loading course..." />;
    }

    return (
        <CourseFormShell
            title="Edit Course"
            subtitle={formData.title || 'Update course details and modules'}
            onBack={() => navigate('/learning')}
        >
            <form onSubmit={handleSave} className="space-y-6">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="md:col-span-2">
                            <label className="mb-1 block text-sm font-medium text-gray-700">Title</label>
                            <input
                                type="text"
                                name="title"
                                value={formData.title}
                                onChange={handleInputChange}
                                required
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                required
                                rows={3}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">Category</label>
                            <select name="category" value={formData.category} onChange={handleInputChange} className="w-full rounded-lg border border-gray-300 px-3 py-2">
                                <option value="Technical">Technical</option>
                                <option value="Soft Skills">Soft Skills</option>
                                <option value="Leadership">Leadership</option>
                                <option value="Compliance">Compliance</option>
                                <option value="Product Knowledge">Product Knowledge</option>
                                <option value="Safety">Safety</option>
                                <option value="Customer Service">Customer Service</option>
                                <option value="Sales">Sales</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
                            <select name="status" value={formData.status} onChange={handleInputChange} className="w-full rounded-lg border border-gray-300 px-3 py-2">
                                <option value="Draft">Draft</option>
                                <option value="Published">Published</option>
                                <option value="Archived">Archived</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-800">Modules</h2>
                            <button
                                type="button"
                                onClick={addModule}
                                className="inline-flex items-center gap-2 rounded-lg bg-theme-secondary px-3 py-2 text-sm text-white hover:bg-theme-primary"
                            >
                                <FaPlus /> Add Module
                            </button>
                        </div>

                        <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-3 md:grid-cols-2">
                            <input
                                type="text"
                                name="moduleTitle"
                                value={newModule.moduleTitle}
                                onChange={handleModuleInputChange}
                                placeholder="Module title"
                                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            />
                            <select
                                name="contentType"
                                value={newModule.contentType}
                                onChange={handleModuleInputChange}
                                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            >
                                <option value="Video">Video</option>
                                <option value="Document">Document</option>
                                <option value="Quiz">Quiz</option>
                                <option value="Assignment">Assignment</option>
                                <option value="Link">Link</option>
                                <option value="Interactive">Interactive</option>
                            </select>
                            <input
                                type="text"
                                name="contentUrl"
                                value={newModule.contentUrl}
                                onChange={handleModuleInputChange}
                                placeholder="Content URL"
                                className="rounded-lg border border-gray-300 px-3 py-2 text-sm md:col-span-2"
                            />
                            <textarea
                                name="moduleDescription"
                                value={newModule.moduleDescription}
                                onChange={handleModuleInputChange}
                                placeholder="Module description"
                                rows={2}
                                className="rounded-lg border border-gray-300 px-3 py-2 text-sm md:col-span-2"
                            />
                        </div>

                        {formData.content.length === 0 ? (
                            <p className="text-sm text-gray-500">No modules added.</p>
                        ) : (
                            <div className="space-y-2">
                                {formData.content.map((module, index) => (
                                    <div key={`${module.moduleTitle}-${index}`} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3">
                                        <div>
                                            <p className="font-medium text-gray-800">{module.moduleTitle || `Module ${index + 1}`}</p>
                                            <p className="text-xs text-gray-600">{module.contentType || 'Content'} {module.duration ? `• ${module.duration} mins` : ''}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeModule(index)}
                                            className="rounded p-2 text-red-500 hover:bg-red-50 hover:text-red-700"
                                        >
                                            <FaTrash />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-60"
                            style={{ background: MINT_GRADIENT }}
                        >
                            <FaSave /> {saving ? 'Saving...' : 'Save Course'}
                        </button>
                    </div>
                </form>
        </CourseFormShell>
    );
};

export default EditCourse;
