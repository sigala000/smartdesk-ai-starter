import { PublicChat } from "@/components/chat/public-chat";
import { resolveLocale } from "@/lib/i18n/messages";

type Props = Readonly<{
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<{ lang?: string }>;
}>;

export default async function ChatPage({ params, searchParams }: Props) {
  const { organizationSlug } = await params;
  const { lang } = await searchParams;
  const locale = resolveLocale(lang);
  return (
    <main className="public-chat-page" id="main-content" lang={locale}>
      <PublicChat organizationSlug={organizationSlug} locale={locale} />
    </main>
  );
}
