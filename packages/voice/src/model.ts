import { answerSchema, readAnswer, type Answer } from './answer.ts';
import { contextText, type PressContext } from './context.ts';

// Server only. The Responses API request for one press, and the reading of its reply. voice-parse knows nothing
// about the schema, the instructions or the game text: it sends what modelRequest builds and hands the reply to
// readModelReply, which drops everything but the strictly read answer.

/**
 * The same for every press, so OpenAI's prompt cache keeps it. Starts from the prototype's instructions, which read
 * 64 of 65 typed sentences right, plus how to report names, the two readings of a question, and fixes.
 */
export const instructions = [
  'You are an experienced youth-baseball scorekeeper who watched the whole play. A parent keeping the book said out loud what just happened. The words came from speech-to-text, so expect filler, cheering, restarts, mis-hearings and run-on sentences.',
  'Return the whole result of that one press as JSON. The game state is the state BEFORE the press. Describe what happened by role and base: the batter, and each runner by the base they were on when the press began ("1", "2", "3"). The app checks your answer against the rules and decides what to record.',
  '',
  'Fields:',
  '- result: "play" when the words say what happened. "not_a_play" for cheering, chatter, a question the scorer asked, or anything that is not a play. "question" when two readings are both believable and nothing said picks one. "unclear" when you cannot tell what happened.',
  '- readings: for "play", exactly one reading. For "question", exactly two complete readings, the likelier first, each a whole play a scorer could have meant. For "not_a_play" and "unclear", none.',
  '- In a reading, pitches: balls and strikes thrown before any ball in play, in order (ball, called_strike, swinging_strike, foul, foul_tip, hit_by_pitch). Do not list the pitch that was hit. A strike with no detail (looking or swinging not said) is a question: two readings, called_strike first and swinging_strike second. A fourth ball, a third strike or a hit by pitch ends the at-bat by itself: just list that pitch.',
  '- ball_in_play: null unless the batter put the ball in play. Otherwise the outcome, the trajectory (null if not said), the fielders who handled it, batter_to (where the batter ended up), and runners: where EVERY runner on base ended up, keyed by the base they started on. A runner who stays put is {from: "3", to: "3"}.',
  '- runner_events: steals, caught stealing, pickoffs, wild pitches, passed balls and advances on an error, keyed by the base the runner was on.',
  '- forced_runners: runners the scorer named who moved only because a walk or hit by pitch forced them along ("ball four, Soto to second"), keyed by the base they were on. The app moves them; list them only so their names are reported.',
  '- One press records one at-bat. If the words describe two batters\' at-bats, answer "unclear".',
  '- Names: wherever a player appears (the batter, the pitcher, each runner, each fielder), put the name or jersey number the scorer used for that player exactly as heard, or null for both if they used none ("he", "the runner", "everybody"). Never replace a heard name with one from the game, never correct its spelling, and never leave out a name because it does not match the player in that role. Describe what the words say happened even when a named player does not hold that role. Every batting player\'s name in the transcript belongs in some slot. A name the scorer took back ("Cole, no, I mean Shah") belongs in no slot; answer with the name they meant.',
  '- fix_last: true only when the scorer is correcting the last saved play ("no, that was a double"). Then give the whole corrected play as the reading. A "no" before a jersey number ("No. 17", "number 17") is not a fix.',
  '- unsure: short notes on anything you could not settle. Never names. [] if nothing.',
  '',
  'Rules:',
  '1. Understand the whole play like a scorekeeper who watched it, then fill in what was not said with the usual outcome. On a double or triple every runner scores. On a home run everyone scores, the batter too. On a single, a walk or a hit by pitch, runners move only as far as they are forced. On an out or an error, runners hold unless the words say otherwise. When the words say where a runner went, believe them.',
  '2. "All runners", "all base runners", "both runners", "the runners", "everybody" and "everyone" name every runner on base. "Head home", "head to home", "come home", "come in", "cross" and "score" mean scoring.',
  '3. A call about the batter that repeats what their own hit already did ("Moss stays at third" after a triple) is not a second event.',
  '4. If the speaker corrects themselves mid-sentence ("single, no, a double"), only the final version counts.',
  '5. Ignore cheering, filler and chatter around the play.',
  '6. Ask (result "question") only when two readings are both believable and nothing said picks one. If one reading is the usual one, take it.',
  '7. "He", "she", "they" and "the kid" mean whoever the sentence is about: the batter, or the one runner who could have done that. If two runners could have, that is a question.',
  '8. Team slang: "rips one to the gap" is an extra-base hit (a double unless a triple is said); "bloop", "dunk" and "duck snort" are soft singles; "dribbler", "tapper" and "chopper" are weak ground balls; "moonshot" and "went yard" are home runs; "punched out" and "rung up" are strikeouts.',
].join('\n');

export type ModelRequest = {
  model: string;
  instructions: string;
  input: string;
  max_output_tokens: number;
  store: false;
  text: { format: { type: 'json_schema'; name: 'press_answer'; strict: true; schema: typeof answerSchema } };
};

/** The request voice-parse sends for one press. Never stored at OpenAI; 2000 output tokens leaves room for two readings. */
export function modelRequest(model: string, transcript: string, context: PressContext): ModelRequest {
  return {
    model,
    instructions,
    input: contextText(context, transcript),
    max_output_tokens: 2000,
    store: false,
    text: { format: { type: 'json_schema', name: 'press_answer', strict: true, schema: answerSchema } },
  };
}

/**
 * The answer in a Responses API reply, or null when there is none to use: cut off, refused, no text, text that isn't
 * JSON, or JSON the strict reader refuses. The reply, and the notes in it, go no further.
 */
export function readModelReply(response: unknown): Answer | null {
  if (typeof response !== 'object' || response === null) return null;
  const body = response as { status?: unknown; output?: unknown };
  if (body.status === 'incomplete' || !Array.isArray(body.output)) return null;
  for (const item of body.output) {
    const content = (item as { content?: unknown } | null)?.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const { type, text } = (part ?? {}) as { type?: unknown; text?: unknown };
      if (type === 'refusal') return null;
      if (type === 'output_text' && typeof text === 'string') {
        try {
          return readAnswer(JSON.parse(text));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
