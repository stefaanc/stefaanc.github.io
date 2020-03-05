/* eslint-env browser, jquery */
/* global grecaptcha */

(function ($) {
    var form = $("#comment-form");

    function onSubmit(event) {
        var formElement = this;

        console.log("comment-form submitted");

        event.preventDefault();

        // validate spam detection field
        if ( $(formElement).find("#comment-form-password").val() != "" ) {
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

    $(form)
    .find("#comment-form-element")
        .submit(onSubmit) // form validation
    .find(".comment-form-cancel")
        .hide(); // hide cancel button

    // functions for html page
    window.STATICMAN = {

        moveForm: function(replyingTo, title) {
            var buttonFrom = $(form).next();
            var buttonTo

            if ( replyingTo == "" ) {
                buttonTo = $("#comment-form-button");
            }
            else {
                buttonTo = $("#comment-form-button-" + replyingTo);
            }

            // don't move when form is sending
            if ( $(form).find("#comment-form-element").hasClass("sending") ) {
                alert("Please wait until the form has been sent")
                return;
            }

            // remove the form from old place
            $(form).remove();
            $(buttonFrom).show();

            // insert the form at new place
            $(buttonTo).before($(form));
            $(buttonTo).hide();

            // adapt form title
            $(form)
            .find(".comment-form-header")
                .html("<h4>" + title + "</h4>")                                 // !!! this needs to use the same html-elements as the ones used on the page !!!
            .find("span")
                .addClass("comment-author");

            // adapt replying_to field
            $(form)
            .find("#comment-form-replying-to")
                .val(replyingTo);

            // show cancel button when the form is a reply, otherwise hide
            if ( replyingTo == "" ) {
                $(form)
                .find("#comment-form-element")
                    .submit(onSubmit)
                .find(".comment-form-cancel")
                    .hide();
            }
            else {
                $(form)
                .find("#comment-form-element")
                    .submit(onSubmit)
                .find(".comment-form-cancel")
                    .show();
            }
        },

        reCAPTCHA: {

            onSubmit: function () {
                var formElement = $(form).find("#comment-form-element");

                console.log("reCAPTCHA checked");

console.log($(formElement).serialize());

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
                        alert('Thanks for posting a comment.  \nYour comment is pending.  \nIt will be made visible after moderation.');
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
                        alert("Oops something went wrong.  The server wasn't able to process this comment.  \n\nPlease try again later.  \nIf the issue persists, please send me an email.");
                    }
                });
            },

            onExpired: function () {
                console.log("reCAPTCHA expired");

                grecaptcha.reset();
                alert("Oops something went wrong.  \n\nPlease try again.");
            },

            onError: function () {
                console.log("reCAPTCHA error");

                grecaptcha.reset();
                alert("Oops something went wrong.  The reCAPTCHA servers could not be reached.  \n\nPlease try again later.");
            }

        }

    }

})(jQuery);
