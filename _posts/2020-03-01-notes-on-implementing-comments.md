---
layout: post
tag: general
image: "/assets/images/avatar.png"

title: "Notes On Implementing Comments"
description: "I added the possibility to leave comments to my posts on my jekyll site on Github Pages using Staticman.  In this post I explain what I did and where I got my information from, and I provide some notes and gotchas based on my experience."

date: 2020-03-01 20:23:41 +0000
toc: true
comments: true
---

I added the possibility to leave comments to my posts.  Instead of describing the whole process in detail, I plan to update this post with the links that I learned from.

<br>

### Staticman

I found out about [staticman](https://staticman.net/docs/), and thought this would give me the most elegant solution.  Tried to install it from the documentation, and guess what?  I couldn't get it to work.  My main stumble-block was that the  documentation is very vague about the access tokens and the github account that process the comments.  This all makes sense once you know it, but until then...  

I went through a couple of blogs and was able to make quite some progress following [the procedure from Travis Downs](https://travisdowns.github.io/blog/2020/02/05/now-with-comments.html).  Looking at the details on [his github repository](https://github.com/travisdowns/travisdowns.github.io) was also a great help.  

Initially, I was trying to use Staticman's `staticmanapp`, but this didn't work well.  So I deployed my own app on [Heroku](https://signup.heroku.com/), as is explained by Travis.

A couple of mistakes that tripped me up:

- In my `staticman.yml`, I had `path: "/_data/comments/{options.slug}"`.  Staticman didn't like this.  You need to drop the initial `/` so it has to be `path: "_data/comments/{options.slug}"`.  I found this out by comparing my file with the file from Travis.

- In my `_config.yml`, I had `staticman_url: https://staticman-stefaanc.herokuapp.com/v2/entry/stefaanc/stefaanc.github.io/master/_data/comments`.    Staticman didn't like this.  You need to drop the initial `/_data` so it has to be `staticman_url: https://staticman-stefaanc.herokuapp.com/v2/entry/stefaanc/stefaanc.github.io/master/comments`.  I again found this out by comparing my file with the file from Travis.

<br>

### reCaptcha

The next step was to get [reCaptcha](https://www.google.com/recaptcha/) working.  I went for the [invisible reCaptcha v2](https://developers.google.com/recaptcha/docs/invisible), because I didn't want to show the typical check-box and I don't think that Staticman already supports v3 (please leave me a comment if you know it does).

To get rid of the big reCAPTCHA badge, I followed [this advise](https://developers.google.com/recaptcha/docs/faq#id-like-to-hide-the-recaptcha-badge.-what-is-allowed).

A couple of gotchas:

- I initially had my `<div class="g-recaptcha" ... ></div>` outside my form.  However, this must be within the `<form> ... </form>` elements to work.

- My callback function are `STATICMAN.reCAPTCHA.onSubmit(token)`, `STATICMAN.reCAPTCHA.onExpired()` and `STATICMAN.reCAPTCHA.onError()`.  I couldn't use these in the reCaptcha `div`

  ```html
  <div class="g-recaptcha" 
    data-callback="STATICMAN.reCAPTCHA.onSubmit"
  >
  </div>
  ```

  Instead, I needed to create a local function like this

  ```html
  <script>
    function reCAPTCHA_OnSubmit(token) { return STATICMAN.reCAPTCHA.onSubmit(token) };
  </script>
  <div class="g-recaptcha" 
    data-callback="reCAPTCHA_OnSubmit"
  >
  </div>
  ```

<br>

### Moving The Form

Travis is using [some code modified from WordPress](https://github.com/travisdowns/travisdowns.github.io/blob/master/assets/main.js#L53) to move the form.  Didn't like this, so I wrote [some jQuery code of my own](https://github.com/stefaanc/stefaanc.github.io/blob/master/assets/staticman.js#L208).

<br>

### A Honeypot

Since reCAPTCHA is very common, I assume some spammers found ways around it, so I wanted to add a honeypot to my form.  I used guidance from [this blog](https://dev.to/felipperegazio/how-to-create-a-simple-honeypot-to-protect-your-web-forms-from-spammers--25n8) and [the stackoverflow comment from yodarunamok](https://stackoverflow.com/questions/36227376/better-honeypot-implementation-form-anti-spam).  

I also needed to add some code to validate the honey-pot field when the form is submitted.  I noticed that Travis doesn't check this - perhaps the Staticman server does? 

<br>

### Avatars

Next step, was adding avatars.  Using [Gravatar](http://en.gravatar.com/) (press the "Create Your Own Gravatar" button) seems to be the standard solution.  However, a lot of people don't like this, because you need to create a Wordpress account for this.  

So I implemented an alternative using [Libravatar](https://www.libravatar.org/).  People still need to provide their email address for this to work, another thing a lot of people don't like.

For github users I implemented the github avatar.  The username is taken from the website specified in the form.  Users can either use their github website or github pages website.

Similarly, this is also possible for facebook when using a facebook website, twitter when using a twitter website and instagram when using a instagram website.

I also implemented a fall-back solution.  I took the `mystery-man` avatar from Gravatar and made the man's profile transparent.  I'm using a coloured background for the image and added the first initial of user's name.  The colour depends on the initial and the length of the name.  I added 12 background colours.

Finally, I added a [profanity-filter](https://github.com/ChaseFlorell/jQuery.ProfanityFilter) for the comment that changes the avatar if the message has swear words.

<br>

### A Comment Preview

I added the possibility to preview the comment before submitting.  This automatically adapts to the input that is provided by the user.  

The main issue with this:

- Find a suitable client-side Markdown to HTML converter.  I chose [showdown.js](https://github.com/showdownjs/showdown).  This may render slightly different HTML than the server-side `kramdown`.

- Find an md5-encoder for the email address.  We need md5 when requesting a gravatar.  I chose [the jQuery-MD5 plug-in](https://github.com/placemarker/jQuery-MD5).

<br>

### Disabling Default "Submit" Behaviour When Pressing "Enter"

During testing, I kept pressing `Enter` after filling an input-field.  This triggers an unwanted `Submit`-action, so wanted to disable this.  I based [my solution](https://github.com/stefaanc/stefaanc.github.io/blob/master/assets/staticman.js#L493) on [a stackoverflow comment from `6ft Dan`](https://stackoverflow.com/questions/1009808/enter-key-press-behaves-like-a-tab-in-javascript).

<br>

### To Do

- find an XSS filter
- add client-side syntax-highlighting in comment-preview
- support for mailgun or alternative

So, this is it for now.  Still some stuff to do, as you can see.
If you see something that I forgot about, please don't hesitate to leave me a comment.

<br>
