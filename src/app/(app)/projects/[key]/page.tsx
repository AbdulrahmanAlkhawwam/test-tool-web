import { redirect } from 'next/navigation';

export default function ProjectIndex({ params }: { params: { key: string } }) {
  redirect(`/projects/${params.key}/cases`);
}
