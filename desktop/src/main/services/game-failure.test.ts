/** @jest-environment node */
import {gameFailure,requestsGameChange} from './game-failure';
it('distinguishes provider settings from unsupported game features',()=>{expect(gameFailure('litellm.UnsupportedParamsError: parameter').kind).toBe('model_configuration');expect(gameFailure('Unsupported physics: negative gravity').kind).toBe('unsupported');});
it('does not turn ordinary questions into failed edits',()=>{expect(requestsGameChange('what would you recommend?')).toBe(false);expect(requestsGameChange('make it a detailed daylight world with a cat')).toBe(true)});
