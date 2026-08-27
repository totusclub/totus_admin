import { redirect } from 'next/navigation';

// The admin panel has no dashboard of its own: the root route goes straight
// to the users list. The calling dashboard lives in calling_v2.
export default function RootPage() {
    redirect('/users');
}
