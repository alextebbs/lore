export default function Page({ params }: { params: { id: string } }) {
  const { id } = params;

  return <div>Character {id} not found.</div>;
}
