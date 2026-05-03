import { Stack } from 'expo-router';

// Root layout: defines the top-level navigation stack for the whole app.
export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="groups/index" options={{ title: 'My Groups' }} />
      <Stack.Screen name="groups/[id]" options={{ headerShown: false }} />
      {/* The expense screens slide up as a modal */}
      <Stack.Screen
        name="expense/_layout"
        options={{ presentation: 'modal', headerShown: false }}
      />
    </Stack>
  );
}
