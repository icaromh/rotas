import React, { useEffect, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Loader } from '../components/Loader';

export const AuthCallback: React.FC = () => {
    const { t } = useTranslation();
    const search: any = useSearch({ strict: false });
    const navigate = useNavigate();
    const [status, setStatus] = useState(t('auth.authenticating'));

    useEffect(() => {
        const code = search.code;
        if (!code) {
            setStatus(t('auth.errorNoCode'));
            setTimeout(() => navigate({ to: '/' }), 3000);
            return;
        }

        fetch('/api/auth/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            // Save user ID and profile picture to localStorage
            localStorage.setItem('strava_user_id', data.userId);
            if (data.supabaseToken) {
                localStorage.setItem('supabaseToken', data.supabaseToken);
            }
            if (data.profileUrl) {
                localStorage.setItem('strava_profile_url', data.profileUrl);
            }
            setStatus(t('auth.success'));
            setTimeout(() => navigate({ to: '/' }), 1500);
        })
        .catch(err => {
            console.error(err);
            setStatus(t('auth.error'));
            setTimeout(() => navigate({ to: '/' }), 3000);
        });
    }, [search.code, navigate]);

    return (
        <div className="flex flex-col items-center justify-center h-full w-full bg-gray-50">
            <Loader isLoading={true} title={t('auth.title')} subtitle={status} />
        </div>
    );
};
