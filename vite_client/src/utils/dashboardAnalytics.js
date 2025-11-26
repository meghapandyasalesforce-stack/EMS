/**
 * Dashboard analytics utility
 * Provides functions for analyzing dashboard data and generating insights
 */

/**
 * Calculate growth rate between two values
 * @param {number} current - Current value
 * @param {number} previous - Previous value
 * @returns {number} Growth rate percentage
 */
export const calculateGrowthRate = (current, previous) => {
  if (!previous || previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

/**
 * Calculate trend (increasing, decreasing, stable)
 * @param {number} current - Current value
 * @param {number} previous - Previous value
 * @returns {string} Trend direction
 */
export const calculateTrend = (current, previous) => {
  if (current > previous) return 'increasing';
  if (current < previous) return 'decreasing';
  return 'stable';
};

/**
 * Get top performers from a dataset
 * @param {Array} data - Array of objects
 * @param {string} metricKey - Key to use for ranking
 * @param {number} limit - Number of top items to return
 * @returns {Array} Top performers
 */
export const getTopPerformers = (data, metricKey, limit = 5) => {
  if (!Array.isArray(data) || data.length === 0) return [];
  
  return [...data]
    .sort((a, b) => {
      const aValue = a[metricKey] || 0;
      const bValue = b[metricKey] || 0;
      return bValue - aValue;
    })
    .slice(0, limit);
};

/**
 * Calculate average from array of numbers
 * @param {Array} values - Array of numbers
 * @returns {number} Average value
 */
export const calculateAverage = (values) => {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + (Number(val) || 0), 0);
  return sum / values.length;
};

/**
 * Calculate percentage distribution
 * @param {Array} data - Array of objects with count/value
 * @param {string} valueKey - Key containing the value
 * @returns {Array} Data with percentage added
 */
export const calculatePercentageDistribution = (data, valueKey = 'value') => {
  if (!Array.isArray(data) || data.length === 0) return [];
  
  const total = data.reduce((sum, item) => sum + (Number(item[valueKey]) || 0), 0);
  
  return data.map(item => ({
    ...item,
    percentage: total > 0 ? ((Number(item[valueKey]) || 0) / total) * 100 : 0
  }));
};

/**
 * Generate dashboard insights
 * @param {Object} currentStats - Current period statistics
 * @param {Object} previousStats - Previous period statistics
 * @returns {Array} Array of insight objects
 */
export const generateInsights = (currentStats, previousStats = {}) => {
  const insights = [];

  // Compare key metrics
  const metrics = ['totalEmployees', 'activeProjects', 'totalRevenue', 'attendanceRate'];
  
  metrics.forEach(metric => {
    const current = currentStats[metric] || 0;
    const previous = previousStats[metric] || 0;
    
    if (previous > 0) {
      const growth = calculateGrowthRate(current, previous);
      const trend = calculateTrend(current, previous);
      
      if (Math.abs(growth) > 5) { // Only show significant changes
        insights.push({
          metric,
          type: trend,
          growth: growth.toFixed(1),
          current,
          previous,
          message: `${metric} is ${trend} by ${Math.abs(growth).toFixed(1)}%`
        });
      }
    }
  });

  return insights;
};

/**
 * Calculate completion rate
 * @param {number} completed - Number of completed items
 * @param {number} total - Total number of items
 * @returns {number} Completion rate percentage
 */
export const calculateCompletionRate = (completed, total) => {
  if (!total || total === 0) return 0;
  return (completed / total) * 100;
};

/**
 * Format large numbers for display
 * @param {number} num - Number to format
 * @returns {string} Formatted number (e.g., "1.2K", "3.5M")
 */
export const formatLargeNumber = (num) => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};

export default {
  calculateGrowthRate,
  calculateTrend,
  getTopPerformers,
  calculateAverage,
  calculatePercentageDistribution,
  generateInsights,
  calculateCompletionRate,
  formatLargeNumber,
};

