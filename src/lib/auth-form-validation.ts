type AuthFormMode = 'login' | 'register';

type AuthSubmitValidationInput = {
    username: string;
    password: string;
    mode: AuthFormMode;
    signupCodeRequired: boolean;
    signupCode: string;
    isSubmitting: boolean;
};

export function getAuthSubmitBlockReason(input: AuthSubmitValidationInput): string | null {
    if (input.isSubmitting) {
        return '正在处理，请稍候。';
    }

    if (!input.username.trim()) {
        return '请输入用户名。';
    }

    if (input.password.length < 6) {
        return '密码至少需要 6 个字符。';
    }

    if (input.mode === 'register' && input.signupCodeRequired && !input.signupCode.trim()) {
        return '请输入注册码。';
    }

    return null;
}
