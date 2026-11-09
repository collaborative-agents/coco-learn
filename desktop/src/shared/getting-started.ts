export interface GettingStartedArticle {
  id: string;
  title: string;
  kicker: string;
  readingMinutes: number;
  body: string;
  takeaways: [string, string, string];
  accent: string;
}

export const gettingStartedArticles: GettingStartedArticle[] = [
  {
    id: 'ai-copilot',
    title: 'AI as a thinking partner',
    kicker: 'WORK BETTER WITH AI',
    readingMinutes: 2,
    accent: '#dbeaff',
    body: `A useful AI assistant does more than produce an answer quickly. It can help you see a problem from a different angle, test an early idea, and turn a rough thought into something you can discuss with others. The quality of that collaboration depends on what you bring to the conversation.

Imagine planning a short presentation for a team. If you ask AI to “make slides,” it must guess your audience, purpose, and what matters most. Instead, start with the decision the audience needs to make. Explain what they already know, share the source material, and describe the format you want. Then ask the assistant to propose a structure before it writes the final version.

Treat the first output as a draft. Check its facts against your source, remove claims that sound confident but lack support, and revise the language so it sounds like you. Ask what was omitted or oversimplified. You can also request two different approaches and compare their tradeoffs.

The strongest results come from a short loop: give context, review the draft, and improve it together. AI can speed up the work, but your judgment gives it direction. Before you share the result, ask whether a colleague could understand the central point without your explanation. If not, simplify the story once more.`,
    takeaways: [
      'Lead with the audience and goal',
      'Review the first draft critically',
      'Keep your judgment in the loop',
    ],
  },
  {
    id: 'ai-accuracy',
    title: 'When AI sounds certain',
    kicker: 'CHECK THE CLAIM',
    readingMinutes: 2,
    accent: '#dceaff',
    body: `AI can write a fluent explanation even when its evidence is incomplete. A polished sentence is easy to trust, especially when it includes a date, a statistic, or a familiar source. Fluency, however, is a feature of the writing, not proof that a claim is correct.

Suppose an assistant drafts a presentation about a new technology. It says adoption doubled last year and attributes the number to a report. Before using that slide, open the report. Does the figure refer to the same group, time period, and measure? Was it an estimate, a survey response, or an observed count? If you cannot verify the number, replace it with a narrower claim or leave it out.

Ask AI to identify which sentences need verification and to separate direct evidence from interpretation. These requests can reveal weak spots, but they do not replace checking the original material. Keep a clear link between each important claim and its source.

This habit makes your work stronger without slowing every step. Spend your attention on the claims that matter most to the decision your audience will make. Clear uncertainty is more useful than false confidence. When the source is uncertain, use words that show the limit of what is known. Your audience can then decide how much weight to give the claim.`,
    takeaways: [
      'Fluency is not evidence',
      'Trace important claims to sources',
      'State uncertainty clearly',
    ],
  },
  {
    id: 'ai-privacy',
    title: 'Share context with care',
    kicker: 'WORK RESPONSIBLY',
    readingMinutes: 2,
    accent: '#e4edff',
    body: `AI works better when it understands the task, but more context is not always better. A draft may contain names, account details, internal plans, or information someone shared in confidence. Before pasting it into a tool, decide which details the assistant actually needs.

Imagine you want help turning interview notes into a presentation. The themes and quotations may be useful, while a participant’s name, email address, and exact job title may not be. You can replace identifying details with neutral labels and summarize sensitive passages in your own words. Keep the original notes in the place your team uses to manage private material.

Good prompts describe the audience, the output, and the limits. You might say: “Create three slides for new teammates. Use only the themes below. Do not invent quotations or identify participants.” That gives the assistant a clear job without exposing unnecessary information.

Finally, inspect the output before you share it. Check whether it accidentally reveals a private detail or presents a guess as a fact. Thoughtful context helps AI produce relevant work; careful boundaries make that work safer to use. Before sending the slides, imagine that every person named in the original notes could read them. If a detail would surprise or expose someone, revise it or ask for permission first.`,
    takeaways: [
      'Share only needed details',
      'Set clear limits in the prompt',
      'Inspect before sharing',
    ],
  },
];

export function gettingStartedPrompt(article: GettingStartedArticle): string {
  return `Create a beautiful, responsive, animated HTML page based only on the article below. Return only complete HTML, starting with <!doctype html>. Include a striking hero, three article-backed ideas, and one practical action. Use a rich blue palette, strong typography, generous spacing, and CSS-only motion that respects reduced-motion preferences. Include <img data-coco-mascot alt="Coco fox mascot"> in the hero; Coco's HTML preview will place its real mascot there. Put CSS in a <style> element. Do not use scripts, remote assets or fonts, or invented facts.\n\nArticle: ${article.title}\n${article.body}`;
}

export function gettingStartedStarterPrompt(
  article: GettingStartedArticle,
): string {
  return `I just read the article below. Help me explain its most useful idea to a teammate who has two minutes. Give one concrete example and tell me what you would leave out.\n\nArticle: ${article.title}\n${article.body}`;
}

export const getGettingStartedArticle = (id: string) =>
  gettingStartedArticles.find((article) => article.id === id);
