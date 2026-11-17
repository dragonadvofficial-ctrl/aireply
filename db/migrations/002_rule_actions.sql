-- Keyword rules: choose where a comment reply goes, and let the AI write it from your instructions.
alter table quick_replies add column if not exists respond text not null default 'fixed';
alter table quick_replies add column if not exists instructions text not null default '';
alter table quick_replies add column if not exists comment_action text not null default 'account';

alter table quick_replies drop constraint if exists quick_replies_respond_check;
alter table quick_replies add constraint quick_replies_respond_check check (respond in ('fixed','ai'));
alter table quick_replies drop constraint if exists quick_replies_comment_action_check;
alter table quick_replies add constraint quick_replies_comment_action_check check (comment_action in ('account','public','private','both'));
alter table quick_replies drop constraint if exists quick_replies_match_check;
alter table quick_replies add constraint quick_replies_match_check check (match in ('contains','all','exact','regex'));
