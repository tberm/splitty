import { Stack } from 'expo-router';
import { ExpenseFormProvider } from './ExpenseFormContext';

// This layout wraps all expense screens in a stack navigator.
// The stack is presented as a modal from the group detail screen.
export default function ExpenseLayout() {
  return (
    <ExpenseFormProvider>
      <Stack>
        <Stack.Screen name="[groupId]" options={{ headerShown: false }} />
        <Stack.Screen name="items" options={{ headerShown: false }} />
        <Stack.Screen name="paid-by" options={{ headerShown: false }} />
        <Stack.Screen name="split" options={{ headerShown: false }} />
      </Stack>
    </ExpenseFormProvider>
  );
}
