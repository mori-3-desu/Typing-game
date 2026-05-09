import type { Dispatch } from "react";
import { useCallback, useEffect, useRef } from "react";

import { UI_ANIMATION_CONFIG } from "../../../utils/constants";
import type { GameAction } from "../logic/gameReducer";
import { decideScoreType } from "../logic/popup";

export const usePopupManager = (dispatch: Dispatch<GameAction>) => {
  const popupIdRef = useRef(0);
  const timeoutIdsRef = useRef<Set<number>>(new Set());

  // タイムアウトを安全にスケジュール・管理する共通関数
  const scheduleTrackedTimeout = useCallback(
    (callback: () => void, delayMs: number) => {
      const timeoutId = window.setTimeout(() => {
        callback();
        timeoutIdsRef.current.delete(timeoutId); // 実行完了したらリストから消す
      }, delayMs);
      timeoutIdsRef.current.add(timeoutId); // 実行前にリストへ登録
      return timeoutId;
    },
    [],
  );

  // ポップアップを被らせないようにrefで管理、共通化
  const showTrackedPopup = useCallback(
    (
      buildAddAction: (id: number) => GameAction,
      buildRemoveAction: (id: number) => GameAction,
      duration: number,
    ) => {
      popupIdRef.current += 1;
      const newId = popupIdRef.current;
      dispatch(buildAddAction(newId));

      scheduleTrackedTimeout(() => {
        dispatch(buildRemoveAction(newId));
      }, duration);
    },
    [scheduleTrackedTimeout, dispatch],
  );

  const addScorePopup = useCallback(
    (amount: number) => {
      const type = decideScoreType(amount);
      const text = amount > 0 ? `+${amount}` : `${amount}`;
      showTrackedPopup(
        (id) => ({ type: "ADD_SCORE_POPUP", popup: { id, text, type } }),
        (id) => ({ type: "REMOVE_SCORE_POPUP", id }),
        UI_ANIMATION_CONFIG.POPUP_DURATION_MS,
      );
    },
    [showTrackedPopup],
  );

  const triggerPerfect = useCallback(() => {
    showTrackedPopup(
      (id) => ({ type: "ADD_PERFECT_POPUP", popup: { id } }),
      (id) => ({ type: "REMOVE_PERFECT_POPUP", id }),
      UI_ANIMATION_CONFIG.POPUP_DURATION_MS,
    );
  }, [showTrackedPopup]);

  const addTimePopUp = useCallback(
    (sec: number, isLarge: boolean = false) => {
      showTrackedPopup(
        (id) => ({
          type: "ADD_TIME_POPUP",
          popup: { id, text: `+${sec}秒`, isLarge },
        }),
        (id) => ({ type: "REMOVE_TIME_POPUP", id }),
        UI_ANIMATION_CONFIG.TIME_DURATION_MS,
      );
    },
    [showTrackedPopup],
  );

  useEffect(() => {
    const timeoutIds = timeoutIdsRef.current;

    return () => {
      timeoutIds.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });

      timeoutIds.clear();
    };
  }, []);

  return {
    timeoutIdsRef,
    scheduleTrackedTimeout,
    addScorePopup,
    triggerPerfect,
    addTimePopUp
  };
};
