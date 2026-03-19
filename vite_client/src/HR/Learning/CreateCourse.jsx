import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaTrash, FaSave, FaTimes } from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';

const CreateCourse = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: 'Technical',
        level: 'Beginner',
        duration: 0,
        instructor: '',
        externalInstructor: {
            name: '',
            email: '',
            company: ''
        },
        content: [],
        prerequisites: [],
        skills: [],
        tags: [],
        status: 'Draft',
        enrollmentType: 'Open',
        maxEnrollments: '',
        startDate: '',
        endDate: '',
        certificate: {
            enabled: false,
            template: '',
            validityPeriod: ''
        },
        passingScore: 70
    });

    const [newModule, setNewModule] = useState({
        moduleTitle: '',
        moduleDescription: '',
        contentType: 'Video',
        contentUrl: '',
        duration: 0,
        order: 0,
        isRequired: true
    });

    const [showModuleForm, setShowModuleForm] = useState(false);
    const [newSkill, setNewSkill] = useState('');
    const [newTag, setNewTag] = useState('');

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (name.includes('.')) {
            const [parent, child] = name.split('.');
            setFormData(prev => ({
                ...prev,
                [parent]: {
                    ...prev[parent],
                    [child]: type === 'checkbox' ? checked : value
                }
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: type === 'checkbox' ? checked : (type === 'number' ? parseFloat(value) || 0 : value)
            }));
        }
    };

    const handleModuleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setNewModule(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : (type === 'number' ? parseFloat(value) || 0 : value)
        }));
    };

    const addModule = () => {
        if (!newModule.moduleTitle) {
            alert('Please enter module title');
            return;
        }
        const module = {
            ...newModule,
            order: formData.content.length + 1
        };
        setFormData(prev => ({
            ...prev,
            content: [...prev.content, module]
        }));
        setNewModule({
            moduleTitle: '',
            moduleDescription: '',
            contentType: 'Video',
            contentUrl: '',
            duration: 0,
            order: 0,
            isRequired: true
        });
        setShowModuleForm(false);
    };

    const removeModule = (index) => {
        setFormData(prev => ({
            ...prev,
            content: prev.content.filter((_, i) => i !== index).map((m, i) => ({ ...m, order: i + 1 }))
        }));
    };

    const addSkill = () => {
        if (newSkill.trim() && !formData.skills.includes(newSkill.trim())) {
            setFormData(prev => ({
                ...prev,
                skills: [...prev.skills, newSkill.trim()]
            }));
            setNewSkill('');
        }
    };

    const removeSkill = (skill) => {
        setFormData(prev => ({
            ...prev,
            skills: prev.skills.filter(s => s !== skill)
        }));
    };

    const addTag = () => {
        if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
            setFormData(prev => ({
                ...prev,
                tags: [...prev.tags, newTag.trim()]
            }));
            setNewTag('');
        }
    };

    const removeTag = (tag) => {
        setFormData(prev => ({
            ...prev,
            tags: prev.tags.filter(t => t !== tag)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload = {
                ...formData,
                duration: parseFloat(formData.duration) || 0,
                maxEnrollments: formData.maxEnrollments ? parseInt(formData.maxEnrollments) : undefined,
                startDate: formData.startDate ? new Date(formData.startDate) : undefined,
                endDate: formData.endDate ? new Date(formData.endDate) : undefined,
                certificate: {
                    ...formData.certificate,
                    validityPeriod: formData.certificate.validityPeriod ? parseInt(formData.certificate.validityPeriod) : undefined
                },
                instructor: formData.instructor || undefined,
                externalInstructor: formData.externalInstructor.name ? formData.externalInstructor : undefined
            };

            await axios.post('/v1/admin/learning/courses', payload, { withCredentials: true });
            alert('Course created successfully!');
            navigate('/learning');
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to create course');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <LoadingSpinner message="Creating course..." />;
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-5 transition-all duration-300">
            <div className="max-w-4xl mx-auto">
                <div className="mb-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">Create New Course</h1>
                        <p className="text-gray-600 mt-1">Design and publish training courses</p>
                    </div>
                    <button
                        onClick={() => navigate('/learning')}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 transition"
                    >
                        <FaTimes className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
                    {/* Basic Information */}
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold text-gray-800">Basic Information</h2>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Course Title <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="title"
                                value={formData.title}
                                onChange={handleInputChange}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Description <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                required
                                rows="4"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Category <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="category"
                                    value={formData.category}
                                    onChange={handleInputChange}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                >
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Level
                                </label>
                                <select
                                    name="level"
                                    value={formData.level}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                >
                                    <option value="Beginner">Beginner</option>
                                    <option value="Intermediate">Intermediate</option>
                                    <option value="Advanced">Advanced</option>
                                    <option value="Expert">Expert</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Duration (hours) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    name="duration"
                                    value={formData.duration}
                                    onChange={handleInputChange}
                                    required
                                    min="0"
                                    step="0.5"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Course Content */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-semibold text-gray-800">Course Content</h2>
                            <button
                                type="button"
                                onClick={() => setShowModuleForm(!showModuleForm)}
                                className="px-4 py-2 bg-theme-secondary text-white rounded-lg hover:bg-theme-primary transition flex items-center gap-2"
                            >
                                <FaPlus className="w-4 h-4" />
                                Add Module
                            </button>
                        </div>

                        {showModuleForm && (
                            <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Module Title <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="moduleTitle"
                                            value={newModule.moduleTitle}
                                            onChange={handleModuleInputChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Content Type
                                        </label>
                                        <select
                                            name="contentType"
                                            value={newModule.contentType}
                                            onChange={handleModuleInputChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                        >
                                            <option value="Video">Video</option>
                                            <option value="Document">Document</option>
                                            <option value="Quiz">Quiz</option>
                                            <option value="Assignment">Assignment</option>
                                            <option value="Link">Link</option>
                                            <option value="Interactive">Interactive</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Module Description
                                    </label>
                                    <textarea
                                        name="moduleDescription"
                                        value={newModule.moduleDescription}
                                        onChange={handleModuleInputChange}
                                        rows="2"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Content URL
                                        </label>
                                        <input
                                            type="text"
                                            name="contentUrl"
                                            value={newModule.contentUrl}
                                            onChange={handleModuleInputChange}
                                            placeholder="https://..."
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Duration (minutes)
                                        </label>
                                        <input
                                            type="number"
                                            name="duration"
                                            value={newModule.duration}
                                            onChange={handleModuleInputChange}
                                            min="0"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        name="isRequired"
                                        checked={newModule.isRequired}
                                        onChange={handleModuleInputChange}
                                        className="w-4 h-4"
                                    />
                                    <label className="text-sm text-gray-700">Required Module</label>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={addModule}
                                        className="px-4 py-2 bg-theme-primary text-white rounded-lg hover:bg-theme-primary transition"
                                    >
                                        Add Module
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowModuleForm(false)}
                                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}

                        {formData.content.length > 0 && (
                            <div className="space-y-2">
                                {formData.content.map((module, index) => (
                                    <div key={index} className="bg-gray-50 p-4 rounded-lg flex justify-between items-center">
                                        <div>
                                            <h4 className="font-medium text-gray-800">{module.moduleTitle}</h4>
                                            <p className="text-sm text-gray-600">{module.contentType} • {module.duration} min</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeModule(index)}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            <FaTrash className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Skills & Tags */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Skills</label>
                            <div className="flex gap-2 mb-2">
                                <input
                                    type="text"
                                    value={newSkill}
                                    onChange={(e) => setNewSkill(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                                    placeholder="Add skill"
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                />
                                <button
                                    type="button"
                                    onClick={addSkill}
                                    className="px-4 py-2 bg-theme-secondary text-white rounded-lg hover:bg-theme-primary transition"
                                >
                                    <FaPlus className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {formData.skills.map((skill, index) => (
                                    <span key={index} className="px-3 py-1 bg-theme-secondary/10 text-theme-secondary rounded-full text-sm flex items-center gap-2">
                                        {skill}
                                        <button
                                            type="button"
                                            onClick={() => removeSkill(skill)}
                                            className="text-theme-secondary hover:text-theme-secondary"
                                        >
                                            <FaTimes className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                            <div className="flex gap-2 mb-2">
                                <input
                                    type="text"
                                    value={newTag}
                                    onChange={(e) => setNewTag(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                                    placeholder="Add tag"
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                />
                                <button
                                    type="button"
                                    onClick={addTag}
                                    className="px-4 py-2 bg-theme-secondary text-white rounded-lg hover:bg-theme-primary transition"
                                >
                                    <FaPlus className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {formData.tags.map((tag, index) => (
                                    <span key={index} className="px-3 py-1 bg-theme-primary/10 text-theme-primary rounded-full text-sm flex items-center gap-2">
                                        {tag}
                                        <button
                                            type="button"
                                            onClick={() => removeTag(tag)}
                                            className="text-theme-primary hover:text-theme-primary"
                                        >
                                            <FaTimes className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Settings */}
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold text-gray-800">Settings</h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Enrollment Type
                                </label>
                                <select
                                    name="enrollmentType"
                                    value={formData.enrollmentType}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                >
                                    <option value="Open">Open</option>
                                    <option value="Approval Required">Approval Required</option>
                                    <option value="Assigned Only">Assigned Only</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Max Enrollments
                                </label>
                                <input
                                    type="number"
                                    name="maxEnrollments"
                                    value={formData.maxEnrollments}
                                    onChange={handleInputChange}
                                    min="1"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Start Date
                                </label>
                                <input
                                    type="date"
                                    name="startDate"
                                    value={formData.startDate}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    End Date
                                </label>
                                <input
                                    type="date"
                                    name="endDate"
                                    value={formData.endDate}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Passing Score (%)
                            </label>
                            <input
                                type="number"
                                name="passingScore"
                                value={formData.passingScore}
                                onChange={handleInputChange}
                                min="0"
                                max="100"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            />
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    name="certificate.enabled"
                                    checked={formData.certificate.enabled}
                                    onChange={handleInputChange}
                                    className="w-4 h-4"
                                />
                                <label className="text-sm font-medium text-gray-700">Enable Certificate</label>
                            </div>

                            {formData.certificate.enabled && (
                                <div className="ml-6 space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Validity Period (months)
                                        </label>
                                        <input
                                            type="number"
                                            name="certificate.validityPeriod"
                                            value={formData.certificate.validityPeriod}
                                            onChange={handleInputChange}
                                            min="1"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Status
                            </label>
                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            >
                                <option value="Draft">Draft</option>
                                <option value="Published">Published</option>
                                <option value="Archived">Archived</option>
                            </select>
                        </div>
                    </div>

                    {/* Submit Buttons */}
                    <div className="flex justify-end gap-4 pt-4 border-t">
                        <button
                            type="button"
                            onClick={() => navigate('/learning')}
                            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-theme-secondary text-white rounded-lg hover:bg-theme-primary transition flex items-center gap-2"
                        >
                            <FaSave className="w-4 h-4" />
                            Create Course
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateCourse;

