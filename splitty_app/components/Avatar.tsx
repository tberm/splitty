import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { avatarColors } from '@/constants/colors';

interface Props {
  userId: string;
  name: string;
  size?: number;
}

export function Avatar({ userId, name, size = 32 }: Props) {
  const colors = avatarColors(userId);
  const initial = name.charAt(0).toUpperCase();
  const fontSize = size * 0.4;

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.bg },
      ]}
    >
      <Text style={[styles.initial, { fontSize, color: colors.fg }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontWeight: '700',
  },
});
