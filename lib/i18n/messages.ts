import type {
  editableFields,
  publicActions,
} from "@/lib/domain/conversation-workflow";

export const supportedLocales = ["en", "fr"] as const;
export type AppLocale = (typeof supportedLocales)[number];
type Action = (typeof publicActions)[number];
type Field = (typeof editableFields)[number];

export const messages: Record<
  AppLocale,
  {
    virtualAssistant: string;
    introduction: string;
    opening: string;
    unavailable: string;
    restart: string;
    send: string;
    saving: string;
    requestHuman: string;
    actions: Record<Action, string>;
    fields: Record<Field, string>;
  }
> = {
  en: {
    virtualAssistant: "Virtual request assistant",
    introduction:
      "I’m a virtual assistant. I collect your request for a BuildPro employee; I do not calculate prices or promise schedules.",
    opening: "Opening the virtual assistant…",
    unavailable: "Chat unavailable",
    restart: "Start again",
    send: "Send message",
    saving: "Saving…",
    requestHuman: "Request human support",
    actions: {
      request_quotation: "Request a quotation",
      request_site_visit: "Request a site visit",
      ask_about_services: "Ask about services",
      check_request_status: "Check an existing request",
      report_problem: "Report a problem",
      speak_to_employee: "Speak with an employee",
    },
    fields: {
      service: "Service",
      customer_name: "Full name",
      phone: "Contact number",
      description: "Description",
      location: "Location",
      email: "Email",
      preferred_start_date: "Preferred starting date",
      budget: "Budget range",
    },
  },
  fr: {
    virtualAssistant: "Assistant virtuel de demandes",
    introduction:
      "Je suis un assistant virtuel. Je recueille votre demande pour un employé de BuildPro ; je ne calcule pas les prix et ne promets aucun délai.",
    opening: "Ouverture de l’assistant virtuel…",
    unavailable: "Discussion indisponible",
    restart: "Recommencer",
    send: "Envoyer le message",
    saving: "Enregistrement…",
    requestHuman: "Demander une assistance humaine",
    actions: {
      request_quotation: "Demander un devis",
      request_site_visit: "Demander une visite de site",
      ask_about_services: "Découvrir les services",
      check_request_status: "Vérifier une demande existante",
      report_problem: "Signaler un problème",
      speak_to_employee: "Parler à un employé",
    },
    fields: {
      service: "Service",
      customer_name: "Nom complet",
      phone: "Numéro de contact",
      description: "Description",
      location: "Lieu",
      email: "E-mail",
      preferred_start_date: "Date de début souhaitée",
      budget: "Fourchette de budget",
    },
  },
};

export function resolveLocale(value: unknown): AppLocale {
  return value === "fr" ? "fr" : "en";
}
