/*
 *  Copyright (c) 2005-2009, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
 *
 *  WSO2 Inc. licenses this file to you under the Apache License,
 *  Version 2.0 (the "License"); you may not use this file except
 *  in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing,
 *  software distributed under the License is distributed on an
 *  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 *  KIND, either express or implied.  See the License for the
 *  specific language governing permissions and limitations
 *  under the License.
 *
 */
var pageDecorators = {};
(function() {
    var storeConstants = require('store').storeConstants;
    var tenantApi = require('/modules/tenant-api.js').api;
    var permissionsAPI = require('rxt').permissions;
    var log = new Log('store-page-decorators');
    var GovernanceUtils = Packages.org.wso2.carbon.governance.api.util.GovernanceUtils;
    var PaginationContext = Packages.org.wso2.carbon.registry.core.pagination.PaginationContext;
    var HashMap = java.util.HashMap;
    var ArrayList = java.util.ArrayList;

    pageDecorators.navigationBar = function(ctx, page, utils) {
        var app = require('rxt').app;
        //Change the context to support cross tenant views
        var tenantAppResources = tenantApi.createTenantAwareAppResources(ctx.session);
        //Support for cross tenant views
        ctx = tenantAppResources.context;
        var rxtManager = ctx.rxtManager;
        //Obtain all of the available rxt types
        var availableTypes = app.getUIActivatedAssets(ctx.tenantId);
        var types = [];
        var type;
        var currentType;
        page.isUserDomainAndUrlDomainDifferent = tenantAppResources.isUserDomainAndUrlDomainDifferent;
        page.navigationBar = {};
        var isLandingPage = true;
        for (var index in availableTypes) {
            type = availableTypes[index];
            if (permissionsAPI.hasAssetPermission(permissionsAPI.ASSET_LIST, type, ctx.tenantId, ctx.username)) {
                currentType = rxtManager.getRxtTypeDetails(type);
                currentType.selected = false;
                currentType.style = "all-item";
                currentType.listingUrl = utils.buildAssetPageUrl(currentType.shortName, '/list');
                if (currentType.shortName == page.rxt.shortName) {
                    currentType.selected = true;
                    currentType.style = "active home top-item";
                    isLandingPage = false;
                }
                types.push(currentType);
            }
        }
        page.navigationBar.types = types;
        page.navigationBar.landingPage = isLandingPage;
        return page;
    };
    /**
     * The function populates any text field as a search field
     * @param  {[type]} ctx  [description]
     * @param  {[type]} page [description]
     * @return {[type]}      [description]
     */
    pageDecorators.searchBar = function(ctx, page) {
        page.searchBar = {};
        page.searchBar.searchFields = [];
        var searchFields = page.assetMeta.searchFields;
        for (var index in searchFields) {
            if ((searchFields[index].type == 'text') || (searchFields[index].type == 'options')) {
                page.searchBar.searchFields.push(searchFields[index]);
            }
        }
        return page;
    };
    /**
     * The function populates the categories for the category box
     * @param  {[type]} ctx  [description]
     * @param  {[type]} page [description]
     * @return {[type]}      [description]
     */
    pageDecorators.categoryBox = function(ctx, page) {
        page.categoryBox = {};
        page.categoryBox.categories = page.assetMeta.categories;
        page.categoryBox.searchEndpoint = '/apis/assets?type=' + ctx.assetType;
        return page;
    };
    pageDecorators.authenticationDetails = function(ctx, page) {
        var configs = require('/config/store.json');
        var authenticationMethods = configs.authentication ? configs.authentication : {};
        var activeMethod = authenticationMethods.activeMethod ? authenticationMethods.activeMethod : '';
        //Obtain the details for this method of authentication
        var authDetails = fetchActiveAuthDetails(activeMethod, authenticationMethods.methods || []);
        page.security.method = activeMethod;
        page.security.details = sanitizeAuthDetails(activeMethod, authDetails);
        return page;
    };
    pageDecorators.recentAssets = function(ctx, page) {
        var am = getAssetManager(ctx);
        var ratingApi = require('/modules/rating-api.js').api;
        var assets = am.recentAssets();
        ratingApi.addRatings(assets, am, ctx.tenantId, ctx.username);
        page.recentAssets = assets;
        return page;
    };
    pageDecorators.assetCategoryDetails = function (ctx, page, utils) {
        page.assetCategoryDetails = {};
        page.assetCategoryDetails.hasCategories = false;
        page.assetCategoryDetails.values = [];
        var categoryField = ctx.rxtManager.getCategoryField(ctx.assetType);
        var categoryValues = [];
        var field = ctx.rxtManager.getRxtField(ctx.assetType, categoryField);
        var q = request.getParameter("q");
        if (q) {
            var options = parse("{" + q + "}");
            if (options.category) {
                page.assetCategoryDetails.selectedCategory = options.category;
            }
        }
        if (!field) {
            return;
        }
        var values = field.values[0].value;
        if (!values) {
            return;
        }
        for (var index = 0; index < values.length; index++) {
            categoryValues.push(values[index].value);
        }
        page.assetCategoryDetails.hasCategories = true;
        page.assetCategoryDetails.values = categoryValues;
    };
    pageDecorators.recentAssetsOfActivatedTypes = function(ctx, page) {
        var app = require('rxt').app;
        var asset = require('rxt').asset;
        var permissions = require('rxt').permissions;
        var assetAPI = require('/modules/asset-api.js').api;
        var assets = {};
        var isMoreAssets = false;
        var items = [];
        var assetsByType = [];
        var am;
        var type;
        var rxtDetails;
        var assetMap = {};
        var bookmarkable;
        var tenantAppResources = tenantApi.createTenantAwareAppResources(ctx.session);
        var tenantAssetResources;
        // Supporting cross tenant views
        ctx = tenantAppResources.context;
        types = app.getUIActivatedAssets(ctx.tenantId);
        var typeDetails;
        var ratingApi = require('/modules/rating-api.js').api;
        var q = page.assetMeta.q;
        var query = buildRecentAssetQuery(q);
        var username = ctx.username || null;
        var tenantId = ctx.tenantId;
        var canBookmark = function(type) {
            return permissions.hasAssetPermission(permissions.ASSET_BOOKMARK, type, tenantId, username);
        };
        var bookmarkPerms = {};
        var paging = {'start': 0,
            'count': 8,
            'sortOrder': 'desc',
            'sortBy': 'createdDate',
            'paginationLimit': 8 };
        // check whether the given query is a mediaType search query. Due to REGISTRY-3379.
        // case 1 : Search query provided with mediaType search
        if(isMediaType(query,types)){
            tenantAssetResources = tenantApi.createTenantAwareAssetResources(ctx.session, {
                type: query.mediaType
            });
            assets = tenantAssetResources.am.advanceSearch(query, paging);
            isMoreAssets = assets.length >= paging.paginationLimit;
            if(isMoreAssets) {
                assets.pop();
            }
            page.recentAssets = [];
            page.recentAssetsByType = [];
            typeDetails = ctx.rxtManager.getRxtTypeDetails(query.mediaType);
            page.recentAssetsByType.push({
                assets:assets,
                rxt:typeDetails,
                moreAssets: isMoreAssets
            });
            return;
        }
        // case 2 : Search query provided without a mediaType search
        for (var index in types) {
            typeDetails = ctx.rxtManager.getRxtTypeDetails(types[index]);
            type = typeDetails.shortName;
            tenantAssetResources = tenantApi.createTenantAwareAssetResources(ctx.session, {
                type: type
            });
            bookmarkable = bookmarkPerms[type];
            if (bookmarkable === undefined) {
                bookmarkable = (bookmarkPerms[type] = canBookmark(type));
            }
            am = tenantAssetResources.am;
            if (permissionsAPI.hasAssetPermission(permissionsAPI.ASSET_LIST, type, ctx.tenantId, ctx.username)) {
                if (query) {
                    assets = am.advanceSearch(query, paging);
                    isMoreAssets = assets.length >= paging.paginationLimit;
                    if (isMoreAssets) {
                        assets.pop();
                    }
                } else {
                    assets = am.recentAssets(paging);
                    isMoreAssets = assets.length >= paging.paginationLimit;
                    if (isMoreAssets) {
                        assets.pop();
                    }
                }
                if (assets.length > 0) {
                    //Add subscription details if this is not an anon context
                    if (!ctx.isAnonContext) {
                        addSubscriptionDetails(assets, am, ctx.session, bookmarkable);
                    }
                    ratingApi.addRatings(assets, am, ctx.tenantId, ctx.username);
                    items = items.concat(assets);
                    assetsByType.push({
                        assets: assets,
                        rxt: typeDetails,
                        moreAssets: isMoreAssets
                    });
                }
            }
        }
        page.recentAssets = items;
        page.recentAssetsByType = assetsByType;
    };

    /**
     * Method to check whether a user has entered a mediaType search query.
     */
    var isMediaType = function(q,types){
         var hasMediaType = q ? Boolean(q.mediaType) : false;
         //if a query is not provided or if media type is not provided we will skip media scoping 
         if(!hasMediaType) {
            return hasMediaType;            
         }
         var mediaType = q.mediaType;
        return types.filter(function(type){
            return type === q.mediaType.toLowerCase();
        }).length > 0 ;
    };
    var replaceCategoryQuery = function(q, rxtManager, type) {
        //Determine if a category was provided
        if (!q.hasOwnProperty('category')) {
            return q;
        }
        var categoryField = rxtManager.getCategoryField(type);
        var categoryValue;
        if (!categoryField) {
            return q;
        }
        categoryValue = q.category;
        delete q.category;
        q[categoryField] = categoryValue;
        return q;
    };
    var replaceNameQuery = function(q, rxtManager, type) {
        //Determine if a name was provided
        if (!q.hasOwnProperty('name')) {
            return q;
        }
        var nameField = rxtManager.getNameAttribute(type);
        var nameValue;
        if (!nameField) {
            return q;
        }
        nameValue = q.name;
        delete q.name;
        q[nameField] = nameValue;
        return q;
    };
    var addSubscriptionDetails = function(assets, am, session, bookmarkable) {
        var asset;
        for (var index = 0; index < assets.length; index++) {
            asset = assets[index];
            asset.isSubscribed = am.isSubscribed(asset.id, session);
            asset.bookmarkable = bookmarkable;
        }
    };
    var buildRecentAssetQuery = function(q) {
        if (!q) {
            return null;
        }
        if (q === '') {
            return null;
        }
        var query = "{" + q + "}";
        var queryObj;
        try {
            queryObj = parse(query);
        } catch (e) {
            log.error('Unable to parse query string: ' + query + ' to an object.Exception: ', e);
        }
        return queryObj;
    };
    pageDecorators.popularAssets = function(ctx, page) {
        var app = require('rxt').app;
        var asset = require('rxt').asset;
        var ratingApi = require('/modules/rating-api.js').api;
        var assets = {};
        var items = [];
        var assetsOfType;
        var am;
        var type;
        var tenantAppResources = tenantApi.createTenantAwareAppResources(ctx.session);
        var tenantAssetResources;
        //Support for cross tenant views
        ctx = tenantAppResources.context;
        var types = app.getUIActivatedAssets(ctx.tenantId);
        for (var index in types) {
            type = types[index];
            tenantAssetResources = tenantApi.createTenantAwareAssetResources(ctx.session, {
                type: type
            });
            am = tenantAssetResources.am;
            // if (ctx.isAnonContext) {
            //     am = asset.createAnonAssetManager(ctx.session, type, ctx.tenantId);
            // } else {
            //     am = asset.createUserAssetManager(ctx.session, type);
            // }
            assetsOfType = am.popularAssets();
            ratingApi.addRatings(assetsOfType, am, ctx.tenantId, ctx.username);
            items = items.concat(assetsOfType);
        }
        page.popularAssets = items;
    };
    pageDecorators.tags = function(ctx, page) {
        //Avoid generating tags if there is no asset types
        if(!ctx.assetType) {
            return;
        }
        var paging = {
            'start': 0,
            'count': 0,
            'sortOrder': 'ASC',
            'sortBy': '',
            'paginationLimit': 0
        };
        //Obtain tenant aware resources 
        var resources = tenantApi.createTenantAwareAssetResources(ctx.session, {
            type: ctx.assetType
        });
        page.tags = doTermSearch(resources.context,'tags', paging, true);
        page.selectedTag = selectedTag(resources.context);
        //The tags applied to an asset should only be calculated
        //for the details page
        if((page.meta.pageName === 'details')&&(page.assets.id)){
            page.appliedTags = appliedTags(resources.am,page.assets.id);
        }
        return page;
    };
    pageDecorators.myAssets = function(ctx, page) {
        var resources = tenantApi.createTenantAwareAssetResources(ctx.session, {
            type: ctx.assetType
        });
        //Supprt for cross tenant views
        ctx = resources.context;
        if ((!ctx.assetType) || (ctx.isAnonContext)) {
            log.debug('Ignoring my assets decorator as the asset type was not present');
            return page;
        }
        var am = resources.am;
        page.myAssets = am.subscriptions(ctx.session) || [];
        return page;
    };
    pageDecorators.socialFeature = function(ctx, page) {
        var app = require('rxt').app;
        var constants = require('rxt').constants;
        var utils = require('utils');
        if (!app.isFeatureEnabled(ctx.tenantId, constants.SOCIAL_FEATURE)) {
            log.debug('social feature has been disabled.');
            return page;
        }
        var tenantAppResources = tenantApi.createTenantAwareAppResources(ctx.session);
        //Support for cross tenant views
        ctx = tenantAppResources.context;
        var socialFeatureDetails = app.getSocialFeatureDetails(ctx.tenantId);
        var domain = carbon.server.tenantDomain({
            tenantId: ctx.tenantId
        });
        socialFeatureDetails.keys.urlDomain = domain; //getDomainFromURL(request);
        utils.url.popServerDetails(socialFeatureDetails.keys);
        page.features[constants.SOCIAL_FEATURE] = socialFeatureDetails;
        return page;
    };
    // var getDomainFromURL = function(request) {
    //     var uriMatcher = new URIMatcher(request.getRequestURI());
    //     var tenantedAssetPageUrl = constants.TENANT_URL_PATTERN; // '/{context}/t/{domain}/{+any}';
    //     var superTenantUrl = constants.DEFAULT_SUPER_TENANT_URL_PATTERN; //  = '/{context}/{+any}';
    //     var opts = uriMatcher.match(tenantedAssetPageUrl) || uriMatcher.match(superTenantUrl);
    //     var carbon = require('carbon');
    //     var urlTenantDomain = opts.domain ? opts.domain : constants.MultitenantConstants.SUPER_TENANT_DOMAIN_NAME;
    //     return urlTenantDomain;
    // };
    var buildTenantQualifiedUrlSuffix = function(session) {
        var tenant = tenantApi.activeTenant();
        return '/t/' + tenant.domain;
    };
    pageDecorators.socialSites = function(ctx, page, meta, util) {
        var utils = require('utils');
        if (!utils.reflection.isArray(page.assets || [])) {
            var asset = page.assets;
            var assetUrl = util.buildAssetPageUrl(asset.type, '/details/' + asset.id);
            var process = require('process');
            var host = process.getProperty('server.host');
            var port = process.getProperty('http.port');
            var app = require('rxt').app;
            var context = app.getContext();
            var tenantSuffix = buildTenantQualifiedUrlSuffix(ctx.session);
            var completeAssetUrl = ('http://' + host + ':' + port + context + tenantSuffix + assetUrl);
            page.socialSites = {};
            var facebook = page.socialSites.facebook = {};
            var gplus = page.socialSites.gplus = {};
            var twitter = page.socialSites.twitter = {};
            var diggit = page.socialSites.diggit = {};
            facebook.href = facebookLink(completeAssetUrl, asset);
            gplus.href = gplusLink(completeAssetUrl, asset);
            twitter.href = twitterLink(completeAssetUrl, asset);
            diggit.href = diggitLink(completeAssetUrl, asset);
        }
        return page;
    };
    pageDecorators.embedLinks = function(ctx, page, meta) {
        var utils = require('utils');
        if (!utils.reflection.isArray(page.assets || [])) {
            var asset = page.assets;
            var attributes = asset.attributes || {};
            var widgetLink = '/' + asset.type + 's/widget';
            var assetUrl = widgetLink + '?name=' + asset.name + '&version=' + attributes.overview_version + '&provider=' + attributes.overview_provider;
            page.embedLinks = '<iframe width="450" height="120" src="' + assetUrl + '" frameborder="0" allowfullscreen></iframe>';
        }
        return page;
    };
    pageDecorators.populateGroupingFeatureDetails = function(ctx, page) {
        page.groupingFeature = {};
        page.groupingFeature.isEnabled = ctx.rxtManager.isGroupingEnabled(ctx.assetType);
    };
    pageDecorators.populateAssetVersionDetails = function(ctx, page, utils) {
        if ((page.assets) && (page.assets.id)) {
            var am = getAssetManager(ctx);
            var info = page.assets;
            info.versions = [];
            var versions;
            var asset;
            var entry;
            versions = am.getAssetGroup(page.assets || {});
            versions.sort(function(a1, a2) {
                return am.compareVersions(a1, a2);
            });
            for (var index = 0; index < versions.length; index++) {
                asset = versions[index];
                if (asset.id !== page.assets.id) {
                    entry = {};
                    entry.id = asset.id;
                    entry.name = asset.name;
                    entry.version = asset.version;
                    entry.assetURL = utils.buildAssetPageUrl(ctx.assetType, '/details/' + entry.id);
                    info.versions.push(entry);
                }
            }
            info.isDefault = am.isDefaultAsset(page.assets);
            info.hasMultipleVersions = (info.versions.length > 0) ? true : false;
        }
    };
    pageDecorators.sorting = function(ctx,page){
        var sortBy = "";
        var sort = "";
        var sortHelp = "";
        var sortHelpIcon = "fa-arrow-down";
        var popularActive = false;
        var nameActive = false;
        var nameIcon = "fa-arrow-down";
        var nameNextSort = "DES";
        var dateTimeActive = false;
        var dateTimeIcon = "fa-arrow-down";
        var dateTimeNextSort = "DES";

        var queryString = request.getQueryString();
        if(queryString){
            var parts = queryString.split('&');
            for(var i=0;i<parts.length;i++){
                if(parts[i].indexOf("=") != -1 ){
                    var params = parts[i].split("=");
                    if(params[0] == "sortBy"){
                        sortBy = params[1];
                    }else if(params[0] == "sort"){
                        sort = params[1];
                    }
                }
            }
        }else{
            sortBy = "createdDate";
            sort = "DES";
            sortHelp = 'Date/Time Created';
        }

        if(sortBy == "overview_name" && sort == "DES"){
            sortHelp = 'Name';
            sortHelpIcon = "fa-arrow-down";
            nameActive = true;
            nameIcon = "fa-arrow-down";
            nameNextSort = "ASC";
        }else if(sortBy == "overview_name" && sort == "ASC"){
            sortHelp = 'Name';
            sortHelpIcon = "fa-arrow-up";
            nameActive = true;
            nameIcon = "fa-arrow-up";
        }else if(sortBy == "createdDate" && sort == "DES"){
            sortHelp = 'Date/Time Created';
            sortHelpIcon = "fa-arrow-down";
            dateTimeActive = true;
            dateTimeIcon = "fa-arrow-down";
            dateTimeNextSort = "ASC";
        }else if(sortBy == "createdDate" && sort == "ASC"){
            sortHelp = 'Date/Time Created';
            sortHelpIcon = "fa-arrow-up";
            dateTimeActive = true;
            dateTimeIcon = "fa-arrow-up";
        }else if(sort == "popular"){
            sortHelp = 'Popular';
            sortHelpIcon = "fa-arrow-down";
            popularActive = true;
        }


        page.sorting={
            sort:sort,
            sortBy:sortBy,
            sortHelp:sortHelp,
            sortHelpIcon:sortHelpIcon,
            popularActive:popularActive,
            nameActive:nameActive,
            nameIcon:nameIcon,
            nameNextSort:nameNextSort,
            dateTimeActive:dateTimeActive,
            dateTimeIcon:dateTimeIcon,
            dateTimeNextSort:dateTimeNextSort
        };
        return page;
    };
    pageDecorators.searchHistory = function (ctx, page, utils) {
        var userApi = require('/modules/user-api.js').api;
        page.searchHistory = {};
        page.searchHistory.queries = userApi.getSearchHistory(ctx.session, ctx.assetType);
    };
    var getAssetManager = function(ctx) {
        //       var asset = require('rxt').asset;
        var am;
        var resources = tenantApi.createTenantAwareAssetResources(ctx.session, {
            type: ctx.assetType
        });
        am = resources.am;
        //        var uriMatcher = new URIMatcher(request.getRequestURI());
        //        var tenantedAssetPageUrl = constants.TENANT_URL_PATTERN;// '/{context}/t/{domain}/{+any}';
        //        var superTenantUrl = constants.DEFAULT_SUPER_TENANT_URL_PATTERN;//  = '/{context}/{+any}';
        //        var opts = uriMatcher.match(tenantedAssetPageUrl) || uriMatcher.match(superTenantUrl);
        //        var carbon = require('carbon');
        //        var URLTenantId = carbon.server.tenantId({domain: getDomainFromURL(request)});
        //        if (ctx.isAnonContext || ctx.tenantId != URLTenantId) {
        //            am = asset.createAnonAssetManager(ctx.session, ctx.assetType, URLTenantId);
        //        }else {
        //            am = asset.createUserAssetManager(ctx.session, ctx.assetType);
        //        }
        //        if (ctx.isAnonContext) {
        //            am = asset.createAnonAssetManager(ctx.session, ctx.assetType, ctx.tenantId);
        //        } else {
        //            am = asset.createUserAssetManager(ctx.session, ctx.assetType);
        //        }
        return am;
    };
    var sanitizeAuthDetails = function (method, authDetails) {
        if (method == 'sso') {
            //this is done so we don't expose key store pass and other sensitive info to page.
            return {attributes: {identityProviderURL:
                (authDetails.attributes ? authDetails.attributes.identityProviderURL : '')
            }};
        } else {
            return {};
        }
    };

    var fetchActiveAuthDetails = function(method, methods) {
        for (var key in methods) {
            if (key == method) {
                return methods[key];
            }
        }
        return null;
    };
    var twitterLink = function(assetUrl, asset) {
        var attr = asset.attributes || {};
        var description = attr.overview_description ? attr.overview_description : 'No description';
        return storeConstants.TWITTER_SHARE_LINK + description + '&url=' + assetUrl;
    };
    var facebookLink = function(assetUrl, asset) {
        return storeConstants.FACEBOOK_SHARE_LINK + assetUrl;
    };
    var gplusLink = function(assetUrl, asset) {
        return storeConstants.GPLUS_SHARE_LINK + assetUrl;
    };
    var diggitLink = function(assetUrl, asset) {
        return storeConstants.DIGG_SHARE_LINK + assetUrl;
    };

    /**
     * Find all possible terms and its count for the given facet field
     * @param ctx context
     * @param facetField field used for faceting
     * @param paging pagination context param
     * @param authRequired authorization required flag
     * @returns {Array} term results
     */
    var doTermSearch = function (ctx, facetField, paging, authRequired) {
        var terms = [];
        var results;
        var categoryField;
        if(ctx.assetType) {
            categoryField = ctx.rxtManager.getCategoryField(ctx.assetType);
        }
        var selectedTag;
        var map = HashMap();
        var mediaType;
        var searchPage = '/pages/top-assets';
        var rxtManager = ctx.rxtManager;
        if (ctx.assetType) {
            mediaType = rxtManager.getMediaType(ctx.assetType);
            searchPage =  '/assets/'+ctx.assetType+'/list';
        } else {
            var availableTypes = app.getUIActivatedAssets(ctx.tenantId);
            mediaType = '(';
            for (var index in availableTypes) {
                if (availableTypes.hasOwnProperty(index)) {
                    if (index == 0) {
                        mediaType = mediaType + rxtManager.getMediaType(availableTypes[index]);
                    } else {
                        mediaType = mediaType + ' OR ' + rxtManager.getMediaType(availableTypes[index]);
                    }
                }
            }
            mediaType = mediaType + ')';
        }
        log.debug("term search query criteria:facetField " + facetField + " mediaType " + mediaType);

        var q = request.getParameter("q");
        if (q) {
            var options = parse("{" + q + "}");
            if (options.category) {
                var list = new ArrayList();
                list.add(options.category);
                if(categoryField) {
                    map.put(categoryField, list);
                }
            }
            if (options.tags) {
                selectedTag = options.tags;
            }
        }

        if (facetField) {
            try {
                buildPaginationContext(paging);
                results = GovernanceUtils.getTermDataList(map, facetField, mediaType, authRequired);
                var iterator = results.iterator();
                while (iterator.hasNext()) {
                    var current = iterator.next();
                    var term = {};
                    term.value = current.term;
                    term.frequency = current.frequency;
                    term.searchPage = searchPage;
                    if(selectedTag && selectedTag == current.term){
                        term.selected=true;
                    }
                    else{
                        term.selected=false;
                    }
                    terms.push(term);
                }
            } finally {
                destroyPaginationContext();
            }
        }
        return terms;
    };

    var selectedTag = function (ctx) {

        var searchPage = '/pages/top-assets';
        if (ctx.assetType) {
            var rxtManager = ctx.rxtManager;
            mediaType = rxtManager.getMediaType(ctx.assetType);
            searchPage =  '/assets/'+ctx.assetType+'/list';
        }
        var q = request.getParameter("q");
        var queryTag = "";
        if (q) {
            var options = parse("{" + q + "}");

            if (options.tags) {
                queryTag = options.tags;
            }
            var selectedTag = {};
            selectedTag.value = queryTag;
            selectedTag.url = searchPage;
            return selectedTag;
        }
    };

    /**
     * Obtains all of the tags that have been applied to the asset
     * @param  {Object} assetManager An AssetManager instance
     * @param  {String} assetId     The Id of the asset for which tags should be retrieved
     * @return {Array} An array of tag objects
     */
    var appliedTags = function(assetManager,assetId){
        return assetManager.getTags(assetId) || [];
    };

    var generatePaginationContext = function(paging){
        var page = {};
        page.start = paging.start || constants.DEFAULT_TAGS_PAGIN.start;
        page.count = paging.count || constants.DEFAULT_TAGS_PAGIN.count;
        page.sortOrder = paging.sortOrder || constants.DEFAULT_TAGS_PAGIN.sortOrder;
        page.sortBy = paging.sortBy || constants.DEFAULT_TAGS_PAGIN.sortBy;
        page.paginationLimit = paging.paginationLimit || constants.DEFAULT_TAGS_PAGIN.paginationLimit;
        return page;
    };

    var buildPaginationContext = function(paging){
        paging = paging || {};
        paging = generatePaginationContext(paging);
        if (log.isDebugEnabled()) {
            log.debug('[pagination-context] settting context to : '+stringify(paging));
        }
        PaginationContext.init(paging.start,paging.count,paging.sortOrder,
            paging.sortBy,paging.paginationLimit);
    };

    var destroyPaginationContext = function() {
        PaginationContext.destroy();
        if (log.isDebugEnabled()) {
            log.debug('[pagination-context] successfully destroyed context')
        }
    };
}());
