type PostLoginAuthStatus = {
    authenticated: boolean;
    user: { id: string; username: string } | null;
};

export function getPostLoginAuthError(status: PostLoginAuthStatus): string | null {
    if (!status.authenticated || !status.user) {
        return '登录请求已完成，但会话没有生效。请刷新页面后重试。';
    }

    return null;
}
