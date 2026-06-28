/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { createRoot } from 'react-dom/client';
import { unstableSetCreateRoot } from '@flowgram.ai/form-materials';

import { Editor } from './editor';

/**
 * React 18/19 polyfill for form-materials
 */
unstableSetCreateRoot(createRoot);

export default function WorkflowEditorApp() {
  return (
    <div className="relative h-full min-h-[calc(100vh-64px)]">
      <Editor />
    </div>
  );
}
