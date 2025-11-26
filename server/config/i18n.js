/**
 * Internationalization Configuration
 * i18next setup for backend translations
 */

import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import logger from '../helpers/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Initialize i18n
 * @returns {Promise<void>}
 */
export const initI18n = async () => {
    try {
        await i18next
            .use(Backend)
            .init({
                lng: process.env.DEFAULT_LANGUAGE || 'en',
                fallbackLng: 'en',
                backend: {
                    loadPath: join(__dirname, '../locales/{{lng}}/{{ns}}.json'),
                    addPath: join(__dirname, '../locales/{{lng}}/{{ns}}.missing.json')
                },
                ns: ['common', 'errors', 'messages'],
                defaultNS: 'common',
                interpolation: {
                    escapeValue: false
                },
                returnEmptyString: false,
                returnNull: false
            });

        logger.info('i18n initialized successfully', { 
            defaultLanguage: i18next.language,
            availableLanguages: i18next.languages 
        });
    } catch (error) {
        logger.error('Failed to initialize i18n', { error: error.message });
        // Continue without i18n - system will use English
    }
};

/**
 * Translate a key
 * @param {string} key - Translation key
 * @param {Object} options - Translation options
 * @param {string} lng - Language code
 * @returns {string} Translated string
 */
export const translate = (key, options = {}, lng = null) => {
    try {
        return i18next.t(key, { ...options, lng: lng || i18next.language });
    } catch (error) {
        logger.warn('Translation failed', { key, error: error.message });
        return key; // Return key if translation fails
    }
};

/**
 * Get translated error message
 * @param {string} code - Error code
 * @param {Object} options - Translation options
 * @param {string} lng - Language code
 * @returns {string} Translated error message
 */
export const translateError = (code, options = {}, lng = null) => {
    return translate(`errors:${code}`, options, lng);
};

export default {
    initI18n,
    translate,
    translateError,
    i18next
};

