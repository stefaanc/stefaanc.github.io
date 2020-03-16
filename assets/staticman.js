/* eslint-env browser, jquery */
/* global grecaptcha */
/* global showdown */

(function ($) {
    var form = $("#comment-form");

    function updateCommentHeader(index) {
        var comment;
        var replyingTo;
        var name, initial, colour, userid;
        var avatar;
        var email;
        var website;
        var timestamp, date, months;
        var message, original, filtered, profanity, html, xss;

        console.log("updating header for '#comment-" + index + "'");

        comment = $(document).find("#comment-" + index);

        // update data
        if (index == "0") {
            timestamp = Date.now();

            $(comment)
                .attr("data-timestamp", timestamp);
        }

        // reset profanity-form field
        if (index == "0") {
            $(form).find("#comment-form-profanity")
                .val("");
        }
        $(comment)
            .attr("data-profanity", "");

        // check for profanity
        $(comment)
        .find(".comment-body")
            .profanityFilter({
                externalSwears: "/assets/swearWords.json",
                profaneText: function () {

                    console.log("profanity warning");

                    // update form field
                    if (index == "0") {
                        $(form).find("#comment-form-profanity")
                            .val("warning");
                    }

                    // update comment data
                    $(comment)
                        .attr("data-profanity", "warning");

                }
            });

        // reset xss-form field
        if (index == "0") {
            $(form).find("#comment-form-xss")
                .val("");
        }
        $(comment)
            .attr("data-xss", "");

        // filter href protocols
        message = $(comment).find(".comment-body").html();
        html = message.replace(/href="(\s)*((?!http:|https:)[^"]*:)[^"]*"/igm, 'href="#0"');

        if ( html != message ) {

            console.log("xss warning");

            // update comment
            $(comment)
            .find(".comment-body")
                .html(html);

            // update form field
            if (index == "0") {
                $(form).find("#comment-form-xss")
                    .val("warning");
            }

            // update comment data
            $(comment)
                .attr("data-xss", "warning");
        }

        // get data
        replyingTo = $(comment).attr("data-replying_to");
        name       = $(comment).attr("data-name");
        avatar     = $(comment).attr("data-avatar");
        email      = $(comment).attr("data-email");
        website    = $(comment).attr("data-website");
        timestamp  = $(comment).attr("data-timestamp");
        message    = $(comment).find(".comment-body").html();
        profanity  = $(comment).attr("data-profanity");
        xss        = $(comment).attr("data-xss");

        if ( message ) {
            message = message.trim();
        }

        // show or hide preview
        if ( index == "0" ) {
            if ( !name && !message ) {
                $(form)
                .find(".comment-form-preview-container")
                    .hide("slow");
            }
            else {
                $(form)
                .find(".comment-form-preview-container")
                    .show("slow");
            }
        }

        // update avatar
        if ( !website ) {
            $(comment)
            .find(".comment-avatar > a:first")
                .addClass("disabled")
                .removeAttr("href");
        }
        else {
            $(comment)
            .find(".comment-avatar > a:first")
                .removeClass("disabled")
                .attr("href", website);
        }

        if ( !name ) {
            name = "?";
            initial = "?";
        }
        else {
            initial = name.charAt(0).toUpperCase();
        }

        colour = ( "ABCDEFGHIJKLMNOPQRSTUVWXYZ".indexOf(initial) + 1 + name.length ) % 12;

        $(comment)
        .find(".mm")
            .html(initial)
            .removeClass("mm-0 mm-1 mm-2 mm-3 mm-4 mm-5 mm-6 mm-7 mm-8 mm-9 mm-10 mm-11")
            .addClass("mm-" + colour);

        function checkWebsite(platform) {
            var ws = website;

            if ( !website ) {
                return false;
            }

            if ( ws.startsWith("http:") ) {
                ws = ws.substring(5);
            }
            else if ( ws.startsWith("https:") ) {
                ws = ws.substring(6);
            }

            if ( ws.startsWith("//") ) {
                ws = ws.substring(2);
            }

            if ( ws.startsWith("www.") ) {
                ws = ws.substring(4);
            }

            switch ( platform ) {
                case "github":
                    // try github
                    userid = ws.match(/^github.com\/([^/?#]*)/);
                    if ( userid && userid[1] ) {
                        userid = userid[1];
                        return true;
                    }

                    // try github pages
                    userid = ws.match(/^([^/.]*)\.github.io([/?#]|$)/);
                    if ( userid && userid[1] ) {
                        userid = userid[1];
                        return true;
                    }

                    return false;
                case "facebook":
                    userid = ws.match(/^facebook.com\/([^/?#]*)/);
                    if ( userid && userid[1] ) {
                        userid = userid[1];
                        return true;
                    }

                    return false;
                case "twitter":
                    userid = ws.match(/^twitter.com\/([^/?#]*)/);
                    if ( userid && userid[1] ) {
                        userid = userid[1];
                        return true;
                    }

                    return false;
                case "instagram":
                    userid = ws.match(/^instagram.com\/([^/?#]*)/);
                    if ( userid && userid[1] ) {
                        userid = userid[1];
                        return true;
                    }

                    return false;
                default:
                    return false;
            }
        }

        // only for preview - check if html was stripped
        if ( index == "0" ) {
            original   = $(form).find("#comment-form-message").val();
            filtered = $("<div/>").html(original).text();

            if ( filtered != original ) {
                xss = "warning"
            }
        }

        if ( xss && ( index == "0" ) ) {
            $(comment)
            .find(".comment-avatar img")
                .attr("src", "/assets/images/bomb.png");
        }
        else if ( profanity ) {
            $(comment)
            .find(".comment-avatar img")
                .attr("src", "/assets/images/devil.png");
        }
        else if ( ( avatar == "github" ) && checkWebsite("github") ) {
            $(comment)
            .find(".comment-avatar img")
                .attr("src", "https://github.com/" + userid + ".png");
        }
        else if ( ( avatar == "facebook" ) && checkWebsite("facebook") ) {
            $(comment)
            .find(".comment-avatar img")
                .attr("src", "https://graph.facebook.com/" + userid + "/picture");
        }
        else if ( ( avatar == "twitter" ) && checkWebsite("twitter") ) {
            $(comment)
            .find(".comment-avatar img")
                .attr("src", "https://twitter-avatar.now.sh/" + userid);
        }
        else if ( ( avatar == "instagram" ) && checkWebsite("instagram") ) {
            $.get("https://www.instagram.com/" + userid + "/?__a=1")
            .done(function(data) {
                $(comment)
                .find(".comment-avatar img")
                    .attr("src", data["graphql"]["user"]["profile_pic_url_hd"]);
            })
            .fail(function() {
                $(comment)
                .find(".comment-avatar img")
                    .attr("src", "/assets/images/mystery-man.png");
            })
        }
        else if ( ( avatar == "gravatar" ) && email ) {
            $(comment)
            .find(".comment-avatar img")
                .attr("src", "https://secure.gravatar.com/avatar/" + email + "?d=mm&s=50");
        }
        else if ( ( avatar == "libravatar" ) && email ) {
            $(comment)
            .find(".comment-avatar img")
                .attr("src", "https://seccdn.libravatar.org/avatar/" + email + "?d=mm&s=50");
        }
        else {
            $(comment)
            .find(".comment-avatar img")
                .attr("src", "/assets/images/mystery-man.png");
        }

        // update author
        if ( !website ) {
            $(comment)
            .find(".comment-title > a:first")
                .addClass("disabled")
                .removeAttr("href");
        }
        else {
            $(comment)
            .find(".comment-title > a:first")
                .removeClass("disabled")
                .attr("href", website);
        }

        if ( !name ) {
            name = "?";
        }

        $(comment).find(".comment-author")
            .html(name);

        // update date
        date = new Date(parseInt(timestamp, 10));
        months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        if ( !replyingTo ) {
            $(comment)
            .find(".comment-date")
                .attr("title", "Permalink to this comment")
                .html("commented on " + months[date.getMonth()] + " " + date.getDate() + ", " + date.getFullYear());
        }
        else {
            $(comment)
            .find(".comment-date")
                .attr("title", "Permalink to this reply")
                .html("replied on " + months[date.getMonth()] + " " + date.getDate() + ", " + date.getFullYear());
        }

        // update separator
        if ( !replyingTo ) {
            $(comment)
            .find(".comment-separator-end")
                .removeClass("comment-reply-separator")
        }
        else {
            $(comment)
            .find(".comment-separator-end")
                .addClass("comment-reply-separator")
        }

    }

    function onReset() {
        var formElement = this;

        console.log("comment-form reset");

        // close preview
        $(formElement)
        .find(".comment-form-preview-container")
            .hide("slow");

        // trigger data updates after reset
        setTimeout(function () {
            $(formElement)
            .find("#comment-form-name")
                .data("dontUpdateCommentHeader", true)
                .trigger("change")
            .end()
            .find("#comment-form-avatar")
                .data("dontUpdateCommentHeader", true)
                .trigger("change")
            .end()
            .find("#comment-form-email")
                .data("dontUpdateCommentHeader", true)
                .trigger("change")
            .end()
            .find("#comment-form-website")
                .data("dontUpdateCommentHeader", true)
                .trigger("change")
            .end()
            .find("#comment-form-message")
                .trigger("change")
            .end();
        }, 1);
    }

    function onSubmit(event) {
        var formElement = this;

        console.log("comment-form submitted");

        event.preventDefault();

        // validate spam detection field
        if ( $(formElement).find("#comment-form-password").val() ) {
            alert("Password must not be filled out");
            return false;
        }

        console.log("comment-form validated");

        // prepare for sending
        $(formElement)
        .addClass("sending")
        .find("#comment-form-submit").html(
            '<svg class="comment-form-submit-sending"><use xlink:href="#icon-loading"></use></svg> Sending...'
        );

        // send
        grecaptcha.execute();
    }

    // functions for the html page
    window.STATICMAN = {

        moveForm: function (replyingTo) {
            var formLinkFrom, formLinkTo;
            var replyingToComment, replyingToData;
            var title;

            console.log("moving comment-form to '" + replyingTo + "'");

            // don't move when form is sending
            if ( $(form).find("#comment-form-element").hasClass("sending") ) {
                alert("Please wait until the form has been sent")
                return;
            }

            formLinkFrom = $(form).next();

            // hide old form
            $(form).hide("slow");
            $(formLinkFrom).show("slow", function () {
                // remove the form from old place
                $(form).remove();

                // insert the form at new place
                if ( !replyingTo ) {
                    formLinkTo = $("#comment-form-link-0");
                }
                else {
                    formLinkTo = $("#comment-form-link-" + replyingTo);
                }
                $(formLinkTo).before($(form));

                // get data from the 'replyingTo' comment
                if ( replyingTo ) {
                    replyingToComment = $("#comment-" + replyingTo);
                    replyingToData = {
                        name: $(replyingToComment).attr("data-name")
                    }
                }

                // adapt hidden 'replying_to' form-field
                $(form)
                .find("#comment-form-replying-to")
                    .val(replyingTo);

                // adapt form title
                if ( !replyingTo ) {
                    title = "Leave a comment";
                }
                else {
                    title = 'Reply to <span class="comment-author">' + replyingToData.name + '</span>';
                }

                $(form)
                .find(".comment-form-header")
                    .html("<h4>" + title + "</h4>")                             // !!! this needs to use the same html-elements as used on the page !!!
                .find("span")
                    .addClass("comment-author");

                // adapt preview indentation
                if ( !replyingTo ) {
                    $(form)
                    .find(".comment-form-preview-container")
                        .removeClass("comment-replies");
                }
                else {
                    $(form)
                    .find(".comment-form-preview-container")
                        .addClass("comment-replies");
                }

                // update preview data
                $(form)
                .find("#comment-0")
                    .attr("data-replying_to", replyingTo)

                // update preview header
                updateCommentHeader("0");

                // show cancel button when the form is a reply, otherwise hide
                if ( !replyingTo ) {
                    $(form)
                    .find(".comment-form-cancel")
                        .hide();
                }
                else {
                    $(form)
                    .find(".comment-form-cancel")
                        .show();
                }

                // restore the submit and reset callbacks
                $(form)
                .find("#comment-form-element")
                    .submit(onSubmit)
                    .on('reset', onReset);

                // show updated form
                $(form).show("slow");
                $(formLinkTo).hide("slow");
            });
        },

        onChange: {

            name: function () {
                var comment;
                var nameElement, name;

                console.log("comment-form name changed");

                comment = $(form).find("#comment-0");

                // get data
                nameElement = $(form).find("#comment-form-name")
                name = $(nameElement).val();

                // update data
                $(comment)
                    .attr("data-name", name);

                if ( $(nameElement).data("dontUpdateCommentHeader") ) {
                    $(nameElement)
                        .removeData("dontUpdateCommentHeader");
                }
                else {
                    updateCommentHeader("0");
                }
            },

            avatar: function () {
                var comment;
                var avatarElement, avatar;

                console.log("comment-form avatar changed");

                comment = $(form).find("#comment-0");

                // get data
                avatarElement = $(form).find("#comment-form-avatar");
                avatar = $(avatarElement).val();

                // update data
                $(comment)
                    .attr("data-avatar", avatar);

                if ( $(avatarElement).data("dontUpdateCommentHeader") ) {
                    $(avatarElement)
                        .removeData("dontUpdateCommentHeader");
                }
                else {
                    updateCommentHeader("0");
                }
            },

            email: function () {
                var comment;
                var emailElement, email;

                console.log("comment-form email changed");

                comment = $(form).find("#comment-0");

                // get data
                emailElement = $(form).find("#comment-form-email");
                email = $(emailElement).val();
                if ( email ) {
                    email = $.md5(email)
                }

                // update data
                $(comment)
                    .attr("data-email", email);

                if ( $(emailElement).data("dontUpdateCommentHeader") ) {
                    $(emailElement)
                        .removeData("dontUpdateCommentHeader");
                }
                else {
                    updateCommentHeader("0");
                }
            },

            website: function () {
                var comment;
                var websiteElement, website;

                console.log("comment-form website changed");

                comment = $(form).find("#comment-0");

                // get data
                websiteElement = $(form).find("#comment-form-website");
                website = $(websiteElement).val();

                // update data
                $(comment)
                    .attr("data-website", website);

                if ( $(websiteElement).data("dontUpdateCommentHeader") ) {
                    $(websiteElement)
                        .removeData("dontUpdateCommentHeader");
                }
                else {
                    updateCommentHeader("0");
                }
            },

            password: function () {},

            message: function () {
                var comment;
                var messageElement, message, converter, html;

                console.log("comment-form message changed");

                comment = $(form).find("#comment-0");

                // get data
                messageElement = $(form).find("#comment-form-message");
                message = $(messageElement).val();

                // strip html
                var filtered_message = $("<div/>").html(message).text();

                // update message
                converter = new showdown.Converter();
                converter.setFlavor('github');
                html = converter.makeHtml(filtered_message);

                $(comment)
                .find(".comment-body")
                    .html(html);

                if ( $(messageElement).data("dontUpdateCommentHeader") ) {
                    $(messageElement)
                        .removeData("dontUpdateCommentHeader");
                }
                else {
                    updateCommentHeader("0");
                }
            }
        },

        reCAPTCHA: {

            onSubmit: function () {
                var formElement = $(form).find("#comment-form-element");

                console.log("reCAPTCHA checked");

                $.ajax({
                    type: $(formElement).attr('method'),
                    url:  $(formElement).attr('action'),
                    data: $(formElement).serialize(),
                    contentType: 'application/x-www-form-urlencoded',
                    success: function () {
                        console.log("comment-form sent");

                        $(form)
                        .find("#comment-form-element")
                            .removeClass("sending")
                        .find("#comment-form-submit").html(
                           'Submit'
                        );

                        grecaptcha.reset();
                        alert('Thanks for posting a comment.  \n\nYour comment is pending.  \nIt will be made visible after moderation.');
                    },
                    error: function (err) {
                        var errorJSON = JSON.stringify(err);
                        console.log("comment-form error: " + errorJSON);

                        $(form)
                        .find("#comment-form-element")
                            .removeClass("sending")
                        .find("#comment-form-submit").html(
                           'Submit'
                        );

                        grecaptcha.reset();
                        alert("Oops something went wrong.  \nThe server wasn't able to process this comment.  \n\nPlease try again later.  \nIf the issue persists, please send me an email.");
                    }
                });
            },

            onExpired: function () {
                console.log("reCAPTCHA expired");

                grecaptcha.reset();
                alert("Oops something went wrong.  \nWe didn't get a response from the reCAPTCHA servers.  \n\nPlease try again.");
            },

            onError: function () {
                console.log("reCAPTCHA error");

                grecaptcha.reset();
                alert("Oops something went wrong.  \nThe reCAPTCHA servers could not be reached.  \n\nPlease try again later.");
            }

        }

    }

    // initialize form
    $(form)
    .find("#comment-form-element")
        .submit(onSubmit)
        .on('reset', onReset)
    .find(".comment-form-preview-container")
        .hide()  // hide preview
    .end()
    .find(".comment-form-cancel")
        .hide(); // hide cancel button

    // in a form, prevent "Enter" triggers default "Submit" behaviour, except for textareas and buttons
    $(document).keydown(function(event) {
        var self, nextTabIndex;

        self = $(":focus");

        if (  ( event.key == "Enter" )
           && ( $(self).is("input:not([type='button']):not([type='image']):not([type='reset']):not([type='submit']), select") )
           ) {
            // prevent default "submit" behaviour
            event.preventDefault();

            // move focus
            nextTabIndex = parseInt($(self).attr("tabindex"), 10) + (event.shiftKey ? -1 : 1);
            if ( $("[tabindex=" + nextTabIndex + "]").attr("id") == "comment-form-password" ) {
                nextTabIndex = parseInt($(self).attr("tabindex"), 10) + (event.shiftKey ? -2 : 2);
            }

            $("[tabindex=" + nextTabIndex + "]")
            .filter(":visible")
                .focus();
        }
    });

    // update comment headers
    $(".comment")
        .each(function () {
            var replyingTo = $(this).attr("data-replying_to");
            var index      = $(this).attr("data-index");

            if ( replyingTo ) {
                index = replyingTo + "-" + index;
            }

            updateCommentHeader(index);
        });

    // trigger preview comment data updates when returning to page
    setTimeout(function () {
        $(form)
        .find("#comment-form-name")
            .data("dontUpdateCommentHeader", true)
            .trigger("change")
        .end()
        .find("#comment-form-avatar")
            .data("dontUpdateCommentHeader", true)
            .trigger("change")
        .end()
        .find("#comment-form-email")
            .data("dontUpdateCommentHeader", true)
            .trigger("change")
        .end()
        .find("#comment-form-website")
            .data("dontUpdateCommentHeader", true)
            .trigger("change")
        .end()
        .find("#comment-form-message")
            .trigger("change")
        .end();
    }, 1);

})(jQuery);
