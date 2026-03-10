import { useState, useEffect } from 'react';
import { auth, db } from '../firebase/firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Mock user for development without real Firebase credentials
const MOCK_USER = {
    uid: 'mock-admin-123',
    email: 'admin@docstudio.local',
    displayName: 'Admin User',
    role: 'ADMIN', // ADMIN, EDITOR, REVIEWER
};

export function useDocStudioAuth() {
    const [user, setUser] = useState(null);
    const [role, setRole] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Nếu auth không tồn tại (mock mode)
        if (!auth) {
            console.log('DocStudio Auth: Running in Mock Mode');
            setUser(MOCK_USER);
            setRole(MOCK_USER.role);
            setLoading(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                setUser(firebaseUser);
                try {
                    // Lấy role từ collection docstudio_users
                    const userDocRef = doc(db, 'docstudio_users', firebaseUser.uid);
                    const userDoc = await getDoc(userDocRef);
                    if (userDoc.exists()) {
                        setRole(userDoc.data().role || 'EDITOR');
                    } else {
                        // Khởi tạo default user nếu chưa có
                        await setDoc(userDocRef, {
                            email: firebaseUser.email,
                            role: 'EDITOR',
                            createdAt: new Date().toISOString()
                        });
                        setRole('EDITOR');
                    }
                } catch (error) {
                    console.error("Error fetching user role:", error);
                    setRole('EDITOR'); // Fallback
                }
            } else {
                setUser(null);
                setRole(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const login = async (email, password) => {
        if (!auth) {
            // Mock login always succeeds
            setUser(MOCK_USER);
            setRole(MOCK_USER.role);
            return;
        }
        await signInWithEmailAndPassword(auth, email, password);
    };

    const logout = async () => {
        if (!auth) {
            setUser(null);
            setRole(null);
            return;
        }
        await signOut(auth);
    };

    return { user, role, loading, login, logout, isMock: !auth };
}
