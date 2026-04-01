import { useState, useEffect } from "react";
import { DatabaseService } from "../services/database";
import { initAudio } from "../utils/audio";
import { DIFFICULTY_SETTINGS } from "../utils/constants";
import type { WordDataMap } from "../types";

const preloadImages = () => {
  const images = [
    "/images/level.webp",
    "/images/cloud.webp",
    "/images/Ready.webp",
    "/images/ranking.png",
    "/images/X.jpg",
    ...Object.values(DIFFICULTY_SETTINGS).map((s) => s.bg),
  ];
  images.forEach((src) => {
    const img = new Image();
    img.src = src;
  });
};

export const useAppInit = () => {
  const [ngWordsList, setNgWordsList] = useState<string[]>([]);
  const [dbWordData, setDbWordData] = useState<WordDataMap | null>(null);

  useEffect(() => {
    preloadImages();
    initAudio();
    
    const fetchInitialData = async () => {
      try {
        const { formattedData, ngList } =
          await DatabaseService.fetchAllGameData();
        setDbWordData(formattedData);
        setNgWordsList(ngList);
      } catch (err) {
        console.error("Data fetch error", err);
      }
    };

    fetchInitialData();
  }, []);

  return {
    ngWordsList,
    dbWordData,
  };
};
