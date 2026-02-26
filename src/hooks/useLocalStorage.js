import { useState, useEffect } from 'react';

/**
 * A custom hook that syncs state with localStorage.
 * Acts as a drop-in replacement for Firebase Firestore persistence.
 * @param {string} key - The localStorage key
 * @param {*} initialValue - The default value if nothing is stored
 */
export function useLocalStorage(key, initialValue) {
    const [storedValue, setStoredValue] = useState(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error('Error reading localStorage key:', key, error);
            return initialValue;
        }
    });

    const setValue = (value) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error('Error setting localStorage key:', key, error);
        }
    };

    const removeValue = () => {
        try {
            setStoredValue(initialValue);
            window.localStorage.removeItem(key);
        } catch (error) {
            console.error('Error removing localStorage key:', key, error);
        }
    };

    return [storedValue, setValue, removeValue];
}
