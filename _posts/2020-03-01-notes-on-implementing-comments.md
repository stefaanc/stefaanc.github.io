---
layout: post
category: jekyll
tags: [ jekyll ]
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

- Find an md5-encoder for the email address.  We need md5 when requesting a gravatar or libravatar.  I chose [the jQuery-MD5 plug-in](https://github.com/placemarker/jQuery-MD5).

- Find a suitable client-side Markdown to HTML converter.  I chose [showdown.js](https://github.com/showdownjs/showdown).  This may render slightly different HTML than the server-side `kramdown`.

- Configure [showdown.js](https://github.com/showdownjs/showdown/wiki/Showdown-options) to produce HTML that is as close as possible to `kramdown`.  Remark that in the following, the defaults are for github flavored showdown.

Showdown-Option                        | Default                  | Change
---------------------------------------|:------------------------:|:-----:
`omitExtraWLInCodeBlocks`              | true                     |          &nbsp; 
`noHeaderId`                           | false                    | true
`ghCompatibleHeaderId`                 | true                     |          &nbsp; 
`prefixHeaderId`                       | &nbsp;                   |          &nbsp;
`headerLevelStart`                     | 1                        |          &nbsp;
`parseImgDimensions`                   | false                    |          &nbsp;
`simplifiedAutoLink`                   | true                     | !!! false !!!
`excludeTrailingPuntuationFromURLs`    | false                    |          &nbsp;
`literalMidWordUnderscores`            | true                     |          &nbsp;
`strikethrough`                        | true                     |          &nbsp;
`tables`                               | true                     |          &nbsp;
`tableHeaderId`                        | true                     | false
`ghCodeBlocks`                         | true                     |          &nbsp;
`tasklists`                            | true                     |          &nbsp;
`ghMentions`                           | true                     | !!! false !!!
`ghMentionsLink`                       | `https://github.com/{u}` |          &nbsp;
`smoothLivePreview`                    | false                    |          &nbsp;
`smartIndentationFix`                  | false                    |          &nbsp;
`disableForced4SpacesIndentedSublists` | true                     |          &nbsp;
`simpleLineBreaks`                     | true                     | !!! false !!!
`requireSpaceBeforeHeadingText`        | false                    |          &nbsp;
`encodeEmails`                         | true                     |          &nbsp;

We used the following markdown in a comment and in preview to compare the two converters (remark that you'll need to remove the spaces for the fenced block to work).

```markdown
### Comparing Showdown & Markdown

see my post [Notes On Implementing Comments](/jekyll/2020/03/01/notes-on-implementing-comments.html#a-comment-preview)

#### `omitExtraWLInCodeBlocks`

`var foo = 'bar';`

#### `noHeaderId`

##### This is a header

#### `ghCompatibleHeaderId`

##### This is a header with @#$%

#### `prefixHeaderId`

##### This is a header

#### `headerLevelStart`

##### This is a header

#### `parseImgDimensions`

n.a. (this crashes Jekyll site generation)

#### `simplifiedAutoLink`

some text www.google.com

#### `excludeTrailingPuntuationFromURLs`

check this link www.google.com.

#### `literalMidWordUnderscores`

some text with__underscores__in middle

#### `strikethrough`

~~strikethrough~~

#### `tables`

| h1    |    h2   |      h3 |
|:------|:-------:|--------:|
| 100   | [a][1]  | ![b][2] |
| *foo* | **bar** | ~~baz~~ |

#### `tableHeaderId`

| h1    |    h2   |      h3 |
|:------|:-------:|--------:|
| 100   | [a][1]  | ![b][2] |
| *foo* | **bar** | ~~baz~~ |

#### `ghCodeBlocks`

` ` ` (delete spaces)
some code here
` ` ` (delete spaces)

#### `tasklists`

[x] This task is done  
[ ] This is still pending

#### `ghMentions`

hello there @tivie

#### `ghMentionsLink`

hello there @tivie

#### `smoothLivePreview`

n.a. (we don't use preview feature)

#### `smartIndentationFix`

?

#### `disableForced4SpacesIndentedSublists`

- one
  - two

...

- one
    - two

#### `simpleLineBreaks`

a line
wrapped in two

#### `requireSpaceBeforeHeadingText`

#####header

#### `encodeEmails`

n.a. (this would be stripped because it looks like HTML)

```

<br>

### Disabling Default "Submit" Behaviour When Pressing "Enter"

During testing, I kept pressing `Enter` after filling an input-field.  This triggers an unwanted `Submit`-action, so wanted to disable this.  I based [my solution](https://github.com/stefaanc/stefaanc.github.io/blob/master/assets/staticman.js#L493) on [a stackoverflow comment from `6ft Dan`](https://stackoverflow.com/questions/1009808/enter-key-press-behaves-like-a-tab-in-javascript).

<br>

### Preventing Cross Site Scripting (XSS)

Reading [Markdown's XXS Vulnerability](https://github.com/showdownjs/showdown/wiki/Markdown's-XSS-Vulnerability-%28and-how-to-mitigate-it%29), and a more extensive list of attack vectors on this [XSS filter evasion cheat sheet](https://owasp.org/www-community/xss-filter-evasion-cheatsheet), convinced me I need to do something about this.

There are three cases to consider
- form fields that are placed in HTML attributes: the `name`- and `website`-fields.
- form fields that are supporting HTML in Markdown: the `message`-field.
- form fields that are supporting Markdown links and images: the `message`-field.

<br>

#### HTML Attributes

A first class of XSS vectors is the use of malicious `href`-attributes in `<a>`-elements.

Setting a comment's `website`-field to `javascript:alert('xss-attack')`, this was expanded to

```html
<a href="javascript:alert('xss-attack')" title="Link to author's website">Stefaan Coussement</a>
```

Clicking on the <a href="javascript:alert('xss-attack')" title="Link to author's website">link</a> executes the event-handler.

To avoid this, the `website`-field only allows `http:` and `https:` protocols.  We are using this regexp to reject this field's value: `/^(\s)*((?!http:|https:)[^\s:]*:)/i`

<br>

Another class of XSS vectors is the injection of a malicious event-handler in an HTML element.  I was able to get this to work in the `data-name`- and `data-website`-attributes in the `<div>`-element that surrounds a comment.

Setting a comment's `name`-field to `Stefaan Coussement"onclick="javascript:alert('xss-attack')`, this was expanded to

```html
<div id="comment-5" class="comment"
    data-index="5"
    data-replying_to
    data-name="Stefaan Coussement"
    onclick="javascript:alert('xss-attack')"
    data-avatar
    data-email
    data-website
    data-profanity
    data-xss
    data-timestamp="1583945233418"
    data-uid="f51c50a0-63b7-11ea-81d2-4b36a47afbac"
>
```

Clicking on the element executes the event-handler.

To avoid this, we use Liquid's `escape_once` filter on the `name`- and `website`-fields.  This escapes the `"` character and thus avoids injecting an unwanted event-handler.  We did use `escape_once` instead of `escape` to avoid double-escaping the escaped characters that a user may put in the field.  Remark that I did also try the `url_escape` and `url_encode` filters on the `website`-field but these are not good for this use-case.

<br>

#### HTML In Markdown

To avoid the injection of malicious HTML, we don't allow any HTML in the markdown for comments.  We strip HTML in the markdown input, using the Liquid `strip_html` filter.

```markdown
> hello <a name="n" href="javascript:alert('xss attack')">*you*</a>
```

without stripping:

> hello <a name="n" href="javascript:alert('xss attack')">*you*</a>

when stripped:

> hello *you*

<br>

This also works when trying to cheat the system by nesting HTML

```markdown
> hello <<x>a name="n" href="javascript:alert('xss attack')">*you*<<x>/a>
```

when stripped:

> hello a name="n" href="javascript:alert('xss attack')">*you*/a>

<br>

And this also works when trying to cheat the system by combining Markdown and HTML 

```markdown
> hello <a name="n" 
> href="javascript:alert('xss attack')">*you*</a>
```

when stripped:

> hello href="javascript:alert('xss attack')">*you*

<br>

The problem with this method of stripping is that when using a `<` and a `>` further down in the text, everything between these two characters will be stripped.  Liquid's `strip_html` filter is rather primitive in such cases.

```markdown
> 2 < 3  
> 5 > 4  
```

when stripped:

> 2 5 > 4

<br>

This can be avoided by encoding `<` using `&lt;`

```markdown
> 2 &lt; 3  
> 5 > 4  
```

when stripped:

> 2 < 3  
> 5 > 4  

<br>

For me, the main remaining problem is that it is impossible to use `<br>` in the markdown text of comments, something I do quite a lot 

- to create some white-space between paragraphs.
- to force a line-break (I particularly like to use this in tables).

Using `&nbsp;` instead of `<br>` does seem to do the job of creating white-space between paragraphs, and a double space at the end of a line does force a line-break in some cases.  However, I didn't find a way of forcing a new-line in tables (yet);

<br>

#### Markdown Links & Images

A more sophisticated attack is to use malicious [links or event-handlers](#html-attributes) injected using Markdown links & images.  You can find more information in [this blog](https://medium.com/taptuit/exploiting-xss-via-markdown-72a61e774bf8).  

The first type of XSS attack is using the Markdown links.  To prevent this type of attack, we have to filter out any `href` attribute for `<a>` links with a protocol different from `https:` or `http:`.  We filter this in the markdown output.  We are using this regexp to reject the `href` of a link: `/<a[^>]*href="(\s)*((?!http:|https:)[^\s:]*:)[^"]*"/igm`

```markdown
> hello [*you*](javascript:alert('xss-attack'))
```

without stripping HTML:

> hello [*you*](javascript:alert('xss%20attack'))

when stripping HTML:

> hello [*you*](javascript:alert('xss%20attack'))

when filtered:

> hello [*you*](#0)

<br>

The second type of XSS attack is exploiting event-handlers on Markdown links and images.  This doesn't seem to be a problem with the HTML generated by `kramdown` on the server-side, since `"`-characters are escaped in the `href`-, `src`- and `alt`-attributes of the generated `<a>`- and `<img>`-elements.  However, this is a problem with the `showdown` converter used on the client-side, since it only seems to escape the text for the `alt`-attribute.  But since this is only used in the comment-preview, this would only be a self-inflicted problem and thus no action is required.  

Try the following in a comment

```markdown
> hello [*you*](https://stefaanc.github.io"onclick="javascript:alert('xss-attack'))

> ![boom](/assets/images/bomb.png"onclick="alert('xss-attack'))

> ![boom"onclick="alert('xss-attack')](/assets/images/bomb.png) 
```
 
<br> 

### To Do

- add client-side syntax-highlighting in comment-preview
- support for mailgun or alternative

So, this is it for now.  Still some stuff to do, as you can see.
If you see something that I forgot about, please don't hesitate to leave me a comment.
