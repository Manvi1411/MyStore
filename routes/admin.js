const express = require('express');
const router = express.Router();
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

//requiring product model
let Product = require('../models/product');
const product = require('../models/product');

// Checks if user is authenticated
function isAuthenticatedUser(req, res, next) {
    if(req.isAuthenticated()) {
        return next();
    }
    req.flash('error_msg', 'Please Login first to access this page.')
    res.redirect('/login');
}

let browser;

//Scrape Function
async function scrapeData(url, page) {
    try {
        await page.goto(url, {waitUntil: 'load', timeout : 0});
        const html = await page.evaluate(()=> document.body.innerHTML);
        const $ = await cheerio.load(html);

        let title = $("h1").attr('content');
        let price = $(".price-characteristic").attr("content");

        if(!price) {
            let dollars = $("#price > div > span.hide-content.display-inline-block-m > span > span.price-group.price-out-of-stock > span.price-characteristic").text();
            let cents = $("#price > div > span.hide-content.display-inline-block-m > span > span.price-group.price-out-of-stock > span.price-mantissa").text();
            price = dollars+'.'+cents;
        }

        let seller = '';
        let checkSeller = $('.seller-name');
        if(checkSeller) {
            seller = checkSeller.text();
        }

        let outOfStock = '';
        let checkOutOfStock = $('.prod-ProductOffer-oosMsg');
        if(checkOutOfStock) {
            outOfStock = checkOutOfStock.text();
        }

        let deliveryNotAvaiable = '';
        let checkDeliveryNotAvailable = $('.fulfillment-shipping-text');
        if(checkDeliveryNotAvailable) {
            deliveryNotAvaiable = checkDeliveryNotAvailable.text();
        }

        let stock = '';

        if(!(seller.includes('Walmart')) || outOfStock.includes('Out of Stock') || 
            deliveryNotAvaiable.includes('Delivery not available')) {
                stock = 'Out of stock';
            } else {
                stock = 'In stock';
            }

        return {
            title,
            price,
            stock,
            url
        }

    } catch (error) {
        console.log(error);
    }
}

//GET routes starts here
router.get('/',(req,res)=>{
    res.render('./admin/index');
})
router.get('/new', isAuthenticatedUser, async (req, res)=> {
    try {
        let url = req.query.search;
        if(url) {
            browser = await puppeteer.launch({ args: ['--no-sandbox'] });
            const page = await browser.newPage();
            let result = await scrapeData(url,page);

            let productData = {
                title : result.title,
                price : '$'+result.price,
                stock : result.stock,
                productUrl : result.url
            };
            res.render('./admin/newuser', {productData : productData});
            browser.close();
        } else {
            let productData = {
                title : "",
                price : "",
                stock : "",
                productUrl : ""
            };
            res.render('./admin/newuser', {productData : productData});
        }
    } catch (error) {
        req.flash('error_msg', 'ERROR: '+error);
        res.redirect('/new');
    }
});
router.get('/search',isAuthenticatedUser,(req,res)=>{
    let usersku=req.query.sku;
    if(usersku){
        Product.findOne({sku:usersku})
            .then(product=>{
                if(!product){
                    req.flash('error_msg','Product does not exist in the database');
                    return res.redirect('/search',{productData:''});
                }
                else
                {
                    res.render('./admin/search',{productData:product});
                }
                
            })
            .catch(err=>{
                req.flash('error_msg','ERROR: '+err);
                res.redirect('/search');
            });
    }
    else{
        res.render('./admin/search',{productData:''});
    }

});
router.get('/dashboard',isAuthenticatedUser,(req,res)=>{
    Product.find({})
        .then(products=>{
            res.render('./admin/dashboard',{products:products});
        });
});
router.get('/username',isAuthenticatedUser,(req,res)=>{
    Product.find({})
        .then(products=>{
            res.render('./admin/dashboard',{products:products});
        });
});
router.get('/instock',isAuthenticatedUser,(req,res)=>{
    Product.find({newstock:"In stock"})
        .then(products=>{
            res.render('./admin/instock',{products:products});
        })
        .catch(err=>{
            req.flash('error_msg','ERROR: '+err);
            res.redirect('/dashboard');
        })
})
router.get('/outofstock',isAuthenticatedUser,(req,res)=>{
    Product.find({newstock:"Out of stock"})
        .then(products=>{
            res.render('./admin/outofstock',{products:products});
        })
        .catch(err=>{
            req.flash('error_msg','ERROR: '+err);
            res.redirect('/dashboard');
        })
})
router.get('/pricechanged',isAuthenticatedUser,(req,res)=>{
    Product.find({})
        .then(products=>{
            res.render('./admin/pricechanged',{products:products});
        })
        .catch(err=>{
            req.flash('error_msg','ERROR: '+err);
            res.redirect('/dashboard');
        })
})
router.get('/backinstock',isAuthenticatedUser,(req,res)=>{
    Product.find({$and:[{oldstock:'Out of stock'},{newstock:'In stock'}]})
        .then(products=>{
            res.render('./admin/backinstock',{products:products});
        })
        .catch(err=>{
            req.flash('error_msg','ERROR: '+err);
            res.redirect('./admin/dashboard');
        })
})
router.get('/updated',isAuthenticatedUser,(req,res)=>{
    Product.find({updatestatus:"Updated"})
        .then(products=>{
            res.render('./admin/updated',{products:products});
        })
        .catch(err=>{
            req.flash('error_msg','ERROR: '+err);
            res.redirect('/dashboard');
        })
})
router.get('/notupdated',isAuthenticatedUser,(req,res)=>{
    Product.find({updatestatus:"Not Updated"})
        .then(products=>{
            res.render('./admin/notupdated',{products:products});
        })
        .catch(err=>{
            req.flash('error_msg','ERROR: '+err);
            res.redirect('/dashboard');
        })
})
router.get('/updateproduct',isAuthenticatedUser,(req,res)=>{
    res.render('./admin/updateproduct',{message:''});
})
router.post('/new',isAuthenticatedUser,(req,res)=>{
    let {title,price,stock,url,sku}=req.body;
    let newProduct={
        title:title,
        newprice:price,
        oldprice:price,
        newstock:stock,
        oldstock:stock,
        sku:sku,
        company:"Walmart",
        url:url,
        updatestatus:"Updated"
    };
    product.findOne({sku:sku})
        .then(product=>{
            if(product){
                req.flash('error_msg','Product already exist in the database');
                return res.redirect('/new');
            }
            Product.create(newProduct)
                .then(product=>{
                    req.flash('success_msg','Product successfully added to the database');
                    res.redirect('/new');
                })
        })
        .catch(err=>{
            req.flash('error_msg','ERROR: '+err);
            res.redirect('/new');
        });

});
router.post('/updateproduct',isAuthenticatedUser,async(req,res)=>{
    try{
        res.render('./admin/updateproduct',{message:'Update started'});
        Product.find({})
            .then(async products=>{
                for(let i=0;i<products.length;i++){
                    Product.updateOne({'url':products[i].url},{$set:{'oldprice':products[i].newprice, 'oldstock':products[i].newstock,'updatestatus':'Not Updated' }})
                        .then(products=>{})
                }
                browser=await puppeteer.launch({ args: ['--no-sandbox'] });
                const page=await browser.newPage();
                for(let i=0;i<products.length;i++)
                {
                    let result=await scrapeData(products[i].url,page)
                    Product.updateOne({'url':products[i].url},{$set: {'title':result.title,'newprice':'$'+result.price,'newstock':result.stock,'updatestatus':'Updated'}})
                        .then(products=>{})
                }
                browser.close();
            })
            .catch(err=>{
                req.flash('error_msg','ERROR: '+err);
                res.redirect('./admin/dashboard');
            });
        }catch(error){
            req.flash('error_msg','ERROR: '+err);
            res.redirect('./admin/dashboard');
        }
});
router.delete('/delete/product/:id',isAuthenticatedUser,(req,res)=>{
    let searchQuery={_id:req.params.id};
    Product.deleteOne(searchQuery)
        .then(product=>{
            req.flash('success_msg','Product deleted successfully');
            res.redirect('/dashboard');
        })
        .catch(err=>{
            req.flash('error_msg','ERROR: '+err);
            res.redirect('/dashboard');
        })
})
router.get('*',(req,res)=>{
    res.render('./admin/notfound');
})


module.exports = router;