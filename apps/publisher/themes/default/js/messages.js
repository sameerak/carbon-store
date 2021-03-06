var messages = {};
messages.alertSuccess = function(value){
    $.notify.addStyle('happygreen', {
        html: "<div><i class='icon fw fw-info'></i> <strong>Success! </strong><span data-notify-html/></div>",
        classes: {
            base: {
                "white-space": "nowrap",
                "background-color": "#5CB85C",
                "padding": "10px",
                "font-family":"Open Sans",
                "color":"white",
                "font-weight":300
            },
            supergreen: {
                "color": "white",
                "background-color": "#5CB85C"
            }
        }
    });

    $.notify(value, {
        globalPosition: 'top center',
        className: 'success',
        style: 'happygreen'
    });
};
messages.alertError = function(value){
    $.notify.addStyle('sadred', {
        html: "<div><i class='icon fw fw-error'></i> <strong>Error! </strong><span data-notify-html/></div>",
        classes: {
            base: {
                "white-space": "nowrap",
                "background-color": "#D9534F",
                "padding": "10px",
                "font-family":"Open Sans",
                "color":"white",
                "font-weight":300
            },
            superred: {
                "color": "white",
                "background-color":  "#D9534F"
            }
        }
    });

    $.notify(value, {
        globalPosition: 'top center',
        className: 'error',
        style: 'sadred'
    });
};
messages.alertInfo = function(value){
        $.notify.addStyle('happygreen', {
        html: "<div><i class='icon fw fw-info'></i> <strong>Success! </strong><span data-notify-html/></div>",
        classes: {
            base: {
                "white-space": "nowrap",
                "background-color": "#5CB85C",
                "padding": "10px",
                "font-family":"Open Sans",
                "color":"white",
                "font-weight":300
            },
            supergreen: {
                "color": "white",
                "background-color": "#5CB85C"
            }
        }
    });

    $.notify(value, {
        globalPosition: 'top center',
        className: 'info',
        style:'happygreen'
    });
};
messages.alertInfoLoader = function(value){
    $.notify.addStyle('happygreen', {
        html: "<div><strong></strong><span data-notify-html/></div>",
        classes: {
            base: {
                "white-space": "nowrap",
                "background-color": "#5CB85C",
                "padding": "10px",
                "font-family":"Open Sans",
                "color":"white",
                "font-weight":300
            },
            superblue: {
                "color": "white",
                "background-color": "#5CB85C"
            }
        }
    });

    $.notify(value, {
        globalPosition: 'top center',
        className: 'info',
        autoHide: false,
        style: 'happygreen'
    });

};
messages.alertWarn = function(value){
    $.notify.addStyle('happyyellow', {
        html: "<div><span data-notify-html/></div>",
        classes: {
            base: {
                "white-space": "nowrap",
                "background-color": "Gold",
                "padding": "10px"
            },
            superblue: {
                "color": "white",
                "background-color": "yellow"
            }
        }
    });

    $.notify(value, {
        globalPosition: 'top center',
        className: 'warn',
        style: 'happyyellow'
    });
};
messages.modal_pop = function(modalData){
    var title = modalData.title;
    var content = modalData.content;
    var footer = modalData.footer;

    //setting title
    if(title){
        $('#esModalLabel').html(title).parent().show();
    } else {
        $('#esModalLabel').parent().hide();
        content += '<button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>';
    }

    //setting content
    if(content){
        $('#esModalContent').show().html(content);
    } else {
        $('#esModalContent').hide();
    }

    //setting footer
    if(footer){
        $('#esModalFooter').show().html(footer);
    } else {
        $('#esModalFooter').hide();
    }

    $('#esModal').modal();
};

messages.hideAlertInfoLoader = function(){
    $('.notifyjs-happygreen-info').remove();
};