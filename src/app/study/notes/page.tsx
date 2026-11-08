import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/utils/supabase/server'; // (or wherever your server client is imported from)

export default async function NotesPage() {
  await auth.protect();

  const supabase = await createClient();
  const { data: notes, error } = await supabase
    .from('notes')
    .select('*');

  return (
    <div className='p-8 max-w-4xl mx-auto'>
      <h1 className='text-3xl font-bold mb-6'>Study Notes</h1>
      {error && (
        <p className='text-red-500'>
          Error loading notes: {error.message}
        </p>
      )}
      <ul className='space-y-4'>
        {notes?.map((note) => (
          <li
            key={note.id}
            className='p-4 border rounded-lg shadow-sm'
          >
            <h2 className='font-semibold text-lg'>{note.title}</h2>
          </li>
        ))}
      </ul>
    </div>
  );
}
