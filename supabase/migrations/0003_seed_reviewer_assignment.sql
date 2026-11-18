-- 0003: assign David (reviewer) to Lauren (learner). Run after 0002.
insert into public.reviewer_assignments (reviewer_clerk_user_id, learner_clerk_user_id)
values ('user_3Lp5sH36C36Bdo6h2ad7bRAXP7G', 'user_3LpKNJ84Zo6hc1WCkbtDIoX9t9u')
on conflict do nothing;
