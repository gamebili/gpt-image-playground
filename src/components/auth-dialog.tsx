'use client';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getAuthSubmitBlockReason } from '@/lib/auth-form-validation';
import * as React from 'react';

type AuthMode = 'login' | 'register';

type AuthDialogProps = {
    isOpen: boolean;
    signupAllowed: boolean;
    signupCodeRequired: boolean;
    isSubmitting: boolean;
    error: string | null;
    successMessage: string | null;
    onSubmit: (input: { mode: AuthMode; username: string; password: string; signupCode?: string }) => void;
};

export function AuthDialog({
    isOpen,
    signupAllowed,
    signupCodeRequired,
    isSubmitting,
    error,
    successMessage,
    onSubmit
}: AuthDialogProps) {
    const [mode, setMode] = React.useState<AuthMode>(signupAllowed ? 'register' : 'login');
    const [username, setUsername] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [signupCode, setSignupCode] = React.useState('');

    React.useEffect(() => {
        setMode(signupAllowed ? 'register' : 'login');
    }, [signupAllowed]);

    React.useEffect(() => {
        if (successMessage) {
            setMode('login');
            setPassword('');
            setSignupCode('');
        }
    }, [successMessage]);

    const submitBlockReason = getAuthSubmitBlockReason({
        username,
        password,
        mode,
        signupCodeRequired,
        signupCode,
        isSubmitting
    });
    const canSubmit = !submitBlockReason;

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!canSubmit) return;

        onSubmit({
            mode,
            username,
            password,
            signupCode: signupCode.trim() || undefined
        });
    };

    return (
        <Dialog open={isOpen}>
            <DialogContent className='border-white/20 bg-black text-white sm:max-w-[420px]'>
                <DialogHeader>
                    <DialogTitle className='text-white'>{mode === 'register' ? '创建账号' : '登录'}</DialogTitle>
                    <DialogDescription className='text-white/60'>
                        {mode === 'register' ? '为当前实例创建独立账号。' : '登录后查看自己的图片和历史。'}
                    </DialogDescription>
                </DialogHeader>

                <form className='space-y-4' onSubmit={handleSubmit}>
                    <div className='space-y-2'>
                        <Label htmlFor='auth-username' className='text-white/80'>
                            用户名
                        </Label>
                        <Input
                            id='auth-username'
                            autoComplete='username'
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            className='border-white/20 bg-black text-white placeholder:text-white/40'
                        />
                        <p className='text-xs text-white/45'>用户名支持字母、数字、下划线、点和短横线。</p>
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor='auth-password' className='text-white/80'>
                            密码
                        </Label>
                        <Input
                            id='auth-password'
                            type='password'
                            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            className='border-white/20 bg-black text-white placeholder:text-white/40'
                        />
                        <p className='text-xs text-white/45'>密码至少需要 6 个字符。</p>
                    </div>
                    {mode === 'register' && signupCodeRequired && (
                        <div className='space-y-2'>
                            <Label htmlFor='auth-signup-code' className='text-white/80'>
                                注册码
                            </Label>
                            <Input
                                id='auth-signup-code'
                                type='password'
                                value={signupCode}
                                onChange={(event) => setSignupCode(event.target.value)}
                                className='border-white/20 bg-black text-white placeholder:text-white/40'
                            />
                        </div>
                    )}
                    {successMessage && <p className='text-sm text-emerald-300'>{successMessage}</p>}
                    {error && <p className='text-sm text-red-300'>{error}</p>}
                    {submitBlockReason && !error && !successMessage && (
                        <p className='text-sm text-amber-200'>{submitBlockReason}</p>
                    )}
                    <DialogFooter className='gap-2 sm:justify-between'>
                        {signupAllowed && (
                            <Button
                                type='button'
                                variant='ghost'
                                onClick={() => setMode(mode === 'register' ? 'login' : 'register')}
                                className='text-white/70 hover:bg-white/10 hover:text-white'>
                                {mode === 'register' ? '已有账号' : '创建账号'}
                            </Button>
                        )}
                        <Button
                            type='submit'
                            disabled={!canSubmit}
                            title={submitBlockReason ?? undefined}
                            className='bg-white text-black hover:bg-white/90 disabled:bg-white/10 disabled:text-white/40'>
                            {isSubmitting ? '处理中...' : mode === 'register' ? '创建账号' : '登录'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
