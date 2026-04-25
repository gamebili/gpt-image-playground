import assert from 'node:assert/strict';
import test from 'node:test';

import { getAuthSubmitBlockReason } from './auth-form-validation.ts';

test('getAuthSubmitBlockReason explains missing username', () => {
    assert.equal(
        getAuthSubmitBlockReason({
            username: '',
            password: 'secret123',
            mode: 'register',
            signupCodeRequired: false,
            signupCode: '',
            isSubmitting: false
        }),
        '请输入用户名。'
    );
});

test('getAuthSubmitBlockReason explains password length requirement', () => {
    assert.equal(
        getAuthSubmitBlockReason({
            username: 'alice',
            password: 'short',
            mode: 'register',
            signupCodeRequired: false,
            signupCode: '',
            isSubmitting: false
        }),
        '密码至少需要 6 个字符。'
    );
});

test('getAuthSubmitBlockReason explains missing signup code when required', () => {
    assert.equal(
        getAuthSubmitBlockReason({
            username: 'alice',
            password: 'secret',
            mode: 'register',
            signupCodeRequired: true,
            signupCode: '',
            isSubmitting: false
        }),
        '请输入注册码。'
    );
});

test('getAuthSubmitBlockReason returns null when form can submit', () => {
    assert.equal(
        getAuthSubmitBlockReason({
            username: 'alice',
            password: 'secret',
            mode: 'login',
            signupCodeRequired: true,
            signupCode: '',
            isSubmitting: false
        }),
        null
    );
});
