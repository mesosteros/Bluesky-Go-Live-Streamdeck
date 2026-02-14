import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    prettierConfig,
    {
        ignores: ['node_modules/', 'com.mesos.blueskygolive.sdPlugin/'],
    },
    {
        files: ['src/**/*.ts'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'warn',
        },
    },
    {
        files: ['src/ui/**/*.js'],
        languageOptions: {
            globals: {
                document: 'readonly',
                WebSocket: 'readonly',
                window: 'readonly',
                JSON: 'readonly',
                console: 'readonly',
                URL: 'readonly',
                decodeURIComponent: 'readonly',
            },
        },
        rules: {
            '@typescript-eslint/no-unused-vars': 'off',
            'no-unused-vars': 'off',
        },
    },
);
