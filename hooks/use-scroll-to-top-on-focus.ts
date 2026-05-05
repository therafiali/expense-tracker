import { useCallback, useRef } from 'react';
import { FlatList, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

function scrollToTopSoon(run: () => void) {
  let cancelled = false;
  const id = requestAnimationFrame(() => {
    if (!cancelled) run();
  });
  return () => {
    cancelled = true;
    cancelAnimationFrame(id);
  };
}

/** Scrolls to top whenever this screen gains focus (e.g. after switching tabs). */
export function useScrollToTopOnFocus() {
  const scrollRef = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      return scrollToTopSoon(() => scrollRef.current?.scrollTo({ y: 0, animated: false }));
    }, []),
  );

  return scrollRef;
}

/** Same as {@link useScrollToTopOnFocus} for `FlatList`. */
export function useFlatListScrollToTopOnFocus() {
  const listRef = useRef<FlatList>(null);

  useFocusEffect(
    useCallback(() => {
      return scrollToTopSoon(() => listRef.current?.scrollToOffset({ offset: 0, animated: false }));
    }, []),
  );

  return listRef;
}
