import { PublicChat } from "@/components/chat/public-chat";

type Props = Readonly<{ params: Promise<{ organizationSlug: string }> }>;

export default async function ChatPage({ params }: Props) {
  const { organizationSlug } = await params;
  return (
    <main className="public-chat-page">
      <PublicChat organizationSlug={organizationSlug} />
    </main>
  );
}
