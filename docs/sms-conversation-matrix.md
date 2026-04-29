# SMS Conversation Matrix

This is the first-pass coverage map for Home Harmony SMS conversations. The goal is that a user can text naturally, then follow up with short context-dependent replies without restating every detail.

## Routing Approach

- Let the AI intent router take the first pass for normal Home Harmony texts so wording variations like "Add Girls Soccer Game at 11 AM for tomorrow to calendar for family" and "add girls soccer game to calendar for tomorrow at 11 am for family" resolve the same way.
- Keep deterministic handlers as a fallback for cost, reliability, and simple known commands when AI is unavailable or returns unsupported.
- Keep STOP, START, HELP, Twilio status callbacks, and image/media handling outside the AI route for safety and compliance.
- Store the last referenced calendar event, meal, grocery item, task, reminder, chore, skill, or nutrition item so follow-ups like "delete that", "make that weekly", "what about tomorrow", and "what's the recipe" can resolve without repeating the full request.
- Ask one short clarification question when an action is missing a required detail or has multiple possible matches.

## Calendar

- "What's on my schedule today?" -> return today's calendar, meals, tasks, chores, workouts, and reminders.
- "What about tomorrow?" after a schedule reply -> return tomorrow's schedule.
- "Add Tim and Janette dinner at 5 PM today to family calendar" -> create the event without command words in the title.
- "Move it to 6" after adding an event -> update the recent calendar event.
- "Make that all day" after adding an event -> update the recent calendar event.
- "Delete that" after adding or viewing an event -> delete the recent calendar event when safe, or ask for the event if unclear.
- "Which calendar?" missing from an add request -> ask for Family or the available calendar names, then continue from the short reply.

## Meals And Recipes

- "What's for dinner tonight?" -> return tonight's planned dinner and remember the recipe.
- "What's the recipe?" after dinner lookup -> return saved recipe details.
- "Ingredients?" or "How do I make it?" -> return ingredients or instructions for the remembered recipe.
- "What about tomorrow?" after dinner or recipe lookup -> return tomorrow's dinner, not the full schedule.
- "What meals do we have this week?" -> return the weekly meal plan.
- "What about next week?" after a meal lookup -> return next week's meal plan.
- "Make Friday no meal needed" -> mark the plan as skipped for that date/week.
- "Put taco bowls on Thursday" -> set the meal plan when the recipe exists, otherwise ask for the exact recipe.

## Grocery

- "Add yogurt to grocery list" -> add only "yogurt".
- "Make that weekly" after adding yogurt -> update the remembered grocery item as a weekly staple.
- "Change that to 2 tubs" after a grocery item -> update quantity for the remembered item.
- "Remove that" after adding or listing a specific grocery item -> remove the remembered item when safe.
- "What's on my grocery list?" -> return current grocery list.
- "Mark groceries ordered" -> mark the current order complete.
- "Undo that" after marking ordered -> restore / mark not ordered when intent is clear.

## Tasks And Reminders

- "Remind Ken at 11 AM to get trash bags" -> schedule a text reminder.
- "Move it to noon" after a reminder -> update the remembered reminder when supported, otherwise ask for confirmation/details.
- "Delete that reminder" -> delete the remembered reminder.
- "Add task take trash to road for Ken tomorrow at 6" -> create the task.
- "Who is assigned to that?" after a task reply -> answer from stored task data.
- "Mark it done" after a task -> complete the remembered task.

## Nutrition

- "Log 2 servings of chicken for Ken" -> log the saved food/recipe.
- "Change that to 1.5 servings" -> update the recent meal log.
- "Delete that meal" -> delete the recent meal log.
- "What did I log for lunch today?" -> answer from today's food log.
- "What are my macros now?" -> answer from current macro totals.

## Chores And Skills

- "What chores does Jude have today?" -> answer from chores/skills.
- "Mark that done" after a chore/skill reply -> complete the remembered chore or ask which one if the reply listed several.
- "Add piano practice for Jude 30 minutes weekly" -> add a skill.
- "Make that 45 minutes" after adding a skill -> update the remembered skill.
- "How many points does Jude have?" -> answer from the family chore/skill scoreboard.

## Family, Settings, Billing

- "Who is in my family?" -> answer from household members.
- "Does my wife have access?" -> answer from household and invite data when present.
- "When does my trial end?" -> answer from subscription data.
- "Am I canceled?" -> answer from subscription cancellation fields.
- "What number gets grocery texts?" -> answer from SMS preferences.

## Ambiguity Rules

- If multiple stored items match, list the closest matches and ask for the exact one.
- If a destructive action is requested through the AI agent, ask for YES/NO confirmation first.
- If the user says "it", "that", "those", or "same", resolve from recent conversation when fresh.
- If the recent context conflicts with an explicit domain in the new text, the explicit domain wins.
- If the app cannot safely infer the target, ask one short clarifying question instead of guessing.
