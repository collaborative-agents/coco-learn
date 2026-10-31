/** Legacy quest transcripts have chapter labels; new saves retain a sticky flag. */
export default function isQuestConversation(conversation: {
  agent101Quest?: boolean;
  problem?: string;
}): boolean {
  return (
    conversation.agent101Quest === true ||
    /^Chapter [1-5] · /.test(conversation.problem ?? '')
  );
}
