/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { useService, WorkflowDocument } from "@flowgram.ai/free-layout-editor";

import { ValidateService } from "../../services/validate-service";
import type { ValidateResult } from "../../services/validate-service";

const DEBOUNCE_TIME = 1000;

export const useWatchValidate = () => {
  const [results, setResults] = useState<ValidateResult[]>([]);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const requestIdRef = useRef(0);

  const validateService = useService(ValidateService);
  const workflowDocument = useService(WorkflowDocument);

  const validate = useCallback(() => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      try {
        const res = await validateService.validateNodes();
        if (requestId === requestIdRef.current) {
          setResults(res);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }, DEBOUNCE_TIME);
  }, [validateService]);

  useEffect(() => {
    validate();
    const disposable = workflowDocument.onContentChange(() => {
      validate();
    });
    return () => {
      disposable.dispose();
      clearTimeout(timerRef.current);
      requestIdRef.current += 1;
    };
  }, [validate, workflowDocument]);

  return { results, loading };
};
