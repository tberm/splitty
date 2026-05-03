import { Redirect } from 'expo-router';

// The app always starts at the groups list.
export default function Index() {
  return <Redirect href="/groups" />;
}
