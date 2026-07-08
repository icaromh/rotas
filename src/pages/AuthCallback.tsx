import React, { useEffect, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Loader } from '../components/Loader';
import { API_BASE_URL } from '../api/config';

export const AuthCallback: React.FC = () => {
    const search: any = useSearch({ strict: false });
    const navigate = useNavigate();
    const [status, setStatus] = useState('Authenticating with Strava...');

    useEffect(() => {
        const code = search.code;
        if (!code) {
            setStatus('Error: No authorization code found.');
            setTimeout(() => navigate({ to: '/' }), 3000);
            return;
        }

        fetch(`${API_BASE_URL}/api/auth/callback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            // Save user ID and profile picture to localStorage
            localStorage.setItem('strava_user_id', data.userId);
            if (data.profileUrl) {
                localStorage.setItem('strava_profile_url', data.profileUrl);
            }
            setStatus('Authentication successful! Redirecting...');
            setTimeout(() => navigate({ to: '/' }), 1500);
        })
        .catch(err => {
            console.error(err);
            setStatus('Error during authentication.');
            setTimeout(() => navigate({ to: '/' }), 3000);
        });
    }, [search.code, navigate]);

    return (
        <div className="flex flex-col items-center justify-center h-full w-full bg-gray-50">
            <Loader isLoading={true} title="Strava Authentication" subtitle={status} />
        </div>
    );
};
