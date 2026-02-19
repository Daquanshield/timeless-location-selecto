import { redirect } from 'next/navigation'

export default function ShortVerify({ params }: { params: { code: string } }) {
  redirect(`/dashboard/verify?code=${params.code}`)
}
