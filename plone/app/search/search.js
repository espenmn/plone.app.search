/* The following line defines global variables defined elsewhere. */
/*globals jQuery, portal_url, Modernizr, alert, history, window, location*/

jQuery(function ($) {

    var query, pushState, popped, initialURL,
        $default_res_container = $('#search-results'),
        $search_filter = $('#search-filter'),
        $search_field = $('#search-field'),
        navigation_root_url = $('meta[name=navigation_root_url]').attr('content') || window.navigation_root_url || window.portal_url;

    // The globally available method to pull the search results for the
    // 'query' into the element, on which the method is invoked
    $.fn.pullSearchResults = function (query) {
        return this.each(function () {
            var $container = $(this);
            $.get(
                '@@updated_search',
                query,
                function (data) {
                    $container.hide();
                    var $ajax_search_res = $("#ajax-search-res"),
                        $search_term = $('#search-term');

                    // Before assigning any variable we need to make sure we
                    // have the returned data available (returned somewhere to
                    // the DOM tree). Otherwise we will not be able to select
                    // elements from the returned HTML.
                    if (!$ajax_search_res.length) {
                        // Create temporary container for the HTML structure,
                        // returned by our AJAX request
                        $('body').append('<div id="ajax-search-res"></div>');
                    }
                    $ajax_search_res.html(data);

                    var $data_res = $ajax_search_res.find('#search-results').children(),
                        data_search_term = $ajax_search_res.find('#updated-search-term').text(),
                        data_res_number = $ajax_search_res.find('#updated-search-results-number').text(),
                        data_sorting_opt = $ajax_search_res.find('#updated-sorting-options').html();

                    $container.html($data_res);
                    $container.fadeIn();

                    if (!$search_term.length) {
                        // Until now we had queries with empty search term. So
                        // we need a placeholder for the search term in
                        // result's title.
                        $('h1.documentFirstHeading').append('<strong id="search-term" />');
                    }

                    $search_term.text(data_search_term);
                    $('#search-results-number').text(data_res_number);
                    $('#search-results-bar').find('#sorting-options').html(data_sorting_opt);

                    // Clean after ourselves — empty the ajax results container.
                    // No need to remove the item itself — probably there will
                    // be more search requests for filtering, sorting, etc. So,
                    // we can avoid re-creating the node every time
                    $('#ajax-search-res').empty();

                    $('#rss-subscription').find('a.link-feed').attr('href', function () {
                        return navigation_root_url + '/search_rss?' + query;
                    });
                });
        });
    };

    pushState = function (query) {
        // Now we need to update the browser's path bar to reflect
        // the URL we are at now and to push a history state change
        // in the browser's history. We are using Modernizr
        // library to check whether browser supports HTML5 History
        // API natively or it needs a polyfill, that provides
        // hash-change events to the older browser
        if (Modernizr.history) {
            var url = navigation_root_url + '/@@search?' + query;
            history.pushState(null, null, url);
        }
    };

    // THE HANDLER FOR 'POPSTATE' EVENT IS COPIED FROM PJAX.JS
    // https://github.com/defunkt/jquery-pjax

    // Used to detect initial (useless) popstate.
    // If history.state exists, assume browser isn't going to fire initial popstate.
    popped = (window.history && window.history.hasOwnProperty('state'));
    initialURL = location.href;


    // popstate handler takes care of the back and forward buttons
    //
    // No need to wrap 'popstate' event handler for window object with
    // Modernizr check up since popstate event will contain any data only if
    // a state has been created with history.pushState() that is wrapped in
    // Modernizr checkup above.
    $(window).bind('popstate', function (event) {
        var initialPop, str;
        // Ignore initial popstate that some browsers fire on page load
        initialPop = !popped && location.href === initialURL;
        popped = true;
        if (initialPop) {
            return;
        }

        if (!location.search){
            return;
        }

        query = location.search.split('?')[1];
        // We need to make sure we update the search field with the search
        // term from previous query when going back in history
        str = query.match(/SearchableText=[^&]*/)[0];
        str = decodeURIComponent(str.replace(/\+/g, ' ')); // we remove '+' used between words
        // in search queries.

        // Now we have something like 'SearchableText=test' in str
        // variable. So, we know when the actual search term begins at
        // position 15 in that string.
        $.merge($search_field.find('input[name="SearchableText"]'), $('input#searchGadget')).val(str.substr(15, str.length));

        $default_res_container.pullSearchResults(query);
    });

    $search_filter.find('input.searchPage[type="submit"]').hide();

    // We don't submit the whole form with all the fields when only the
    // search term is being changed. We just alter the current URL to
    // substitute the search term and make a new ajax call to get updated
    // results
    $search_field.find('input.searchButton').click(function (e) {
        var st, queryString = location.search.substring(1),
            re = /([^&=]+)=([^&]*)/g, m, queryParameters = [], key;
        st = $search_field.find('input[name="SearchableText"]').val();
        queryParameters.push({"name":"SearchableText", "value": st});

        // parse query string into array of hash
        while (m = re.exec(queryString)) {
            key = decodeURIComponent(m[1]);
            if (key !== 'SearchableText') {
                // we remove '+' used between words
                queryParameters.push({"name": key, "value": decodeURIComponent(m[2].replace(/\+/g, ' '))});
            }
        }
        queryString = $.param(queryParameters);
        $default_res_container.pullSearchResults(queryString);
        pushState(queryString);
        e.preventDefault();
    });
    $('form.searchPage').submit(function (e) {
        query = $('form.searchPage').serialize();
        $default_res_container.pullSearchResults(query);
        pushState(query);
        e.preventDefault();
    });

    // We need to update the site-wide search field (at the top right in
    // stock Plone) when the main search field is updated
    $search_field.find('input[name="SearchableText"]').keyup(function () {
        $('input#searchGadget').val($(this).val());
    });

    // When we click any option in the Filter menu, we need to prevent the
    // menu from being closed as it is dictated by dropdown.js for all
    // dl.actionMenu > dd.actionMenuContent
    $('#search-results-bar').find('dl.actionMenu > dd.actionMenuContent').click(function (e) {
        e.stopImmediatePropagation();
    });

    // Now we can handle the actual menu options and update the search
    // results after any of them has been chosen.
    $search_filter.delegate('select:not("#pt_toggle")', 'change',
        function (e) {
            query = '';
            // only fill query when there is at least one type selected
            if ($('input[name="portal_type:list"]:checked').length > 0) {
                query = $('form.searchPage').serialize();
            }
            $default_res_container.pullSearchResults(query);
            pushState(query);
            e.preventDefault();
        }
    );

    // Since we replace the whole sorting options with HTML, coming in
    // AJAX response, we should bind the click event with delegate() in order
    // for this to keep working with the HTML elements, coming from AJAX
    // response
    $('#sorting-options').delegate('a', 'click', function (e) {
        if ($(this).attr('data-sort')) {
            $("form.searchPage input[name='sort_on']").val($(this).attr('data-sort'));
        }
        else {
            $("form.searchPage input[name='sort_on']").val('');
        }
        query = this.search.split('?')[1];
        $default_res_container.pullSearchResults(query);
        pushState(query);
        e.preventDefault();
    });

    // Handle clicks in the batch navigation bar. Load those with Ajax as
    // well.
    $default_res_container.delegate('.listingBar a', 'click', function (e) {
        query = this.search.split('?')[1];
        $default_res_container.pullSearchResults(query);
        pushState(query);
        e.preventDefault();
    });
});
