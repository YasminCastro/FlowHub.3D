"use client";

import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api/auth";
import { isNotFoundError } from "@/lib/api/client";
import {
  Calibration,
  CalibrationDetail,
  getCalibration,
  listCalibrations,
} from "@/lib/api/calibration";

/** Carrega uma calibração e as demais (para achar a do outro fatiador). */
export function useCalibration(id: string | null) {
  const [calibration, setCalibration] = useState<CalibrationDetail | null>(null);
  const [all, setAll] = useState<Calibration[]>([]);
  const [isLoading, setIsLoading] = useState(!!id);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    let ignore = false;
    Promise.all([getCalibration(id), listCalibrations()])
      .then(([found, list]) => {
        if (ignore) return;
        setCalibration(found);
        setAll(list);
      })
      .catch((err) => {
        if (ignore) return;
        setIsNotFound(isNotFoundError(err));
        setLoadError(
          err instanceof ApiError
            ? err.message
            : "Não foi possível carregar a calibração.",
        );
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [id]);

  return { calibration, all, isLoading, loadError, isNotFound };
}
