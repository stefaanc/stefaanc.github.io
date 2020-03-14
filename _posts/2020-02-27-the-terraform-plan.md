---
layout: post
tags: [ terraform, terraform-provider ]
image: "/assets/images/terraform-refresh-plan-apply-badge.png"

title: "The Terraform Plan"
description: "I recently started working on Terraform Provider plugins.  In this post I'm discussing the Terraform plan."

date: 2020-02-27 08:28:16 +0000
toc: true
comments: true
---

I recently started working on Terraform Provider plugins, but there doesn't seem to be much information about plugin-development out there on the internet.  So I decided to collect some of my experience in a couple of posts.

![refresh-plan-apply.png](/assets/images/terraform-refresh-plan-apply.png)

When applying a Terraform configuration,
 
1. Terraform starts with a refresh of its state-file, reading the information about its resources from the infrastructure, and updating its state-file. 
 
2. It will look for differences between its state-file and its configuration-files, to make a plan.  

3. It will apply the plan by creating, updating or deleting resources, 

4. Finally, it will refresh its state-file with the information from the updated infrastructure. 

The Terraform plan is calculated based on a function called `Diff`, which calculates the differences between the state of an attribute - Terraform's view on the infrastructure - and the configuration of this attribute in the Terraform configuration-files (`*.tf`).  In this post, I am going to discuss the relation between the outcome of the `Diff`-function, and what you can see in a Terraform plan.  

> :information_source:  
> Remark that the result from a `Diff` can be customized by a Terraform Provider implementation, changing the general rules for an attribute.  I may discuss this in a future post.

It is important that the plan is representing the result from applying that plan as close as possible.  When implementing a provider and when the plan doesn't correspond to the result for an attribute, either the plan must be customized, or the implementation must be changed.  For instance, if a `Computed` value changes when updating a resource, the plan needs to be customized, because the default Terraform plan assumes the value will not change.  
  
A good place to find issues is the Terraform log file, look for `The following problems may be the cause of any confusing errors from downstream operations:`.  It is good practise to reduce the messages under this heading to the minimum.
A lot of the issues mentioned under this heading can be resolved, however some cannot.  For instance, when not specifying a value for an `Optional` attribute with a `Default`, you will get a message like `- .my_attribute: planned value cty.StringVal("default") does not match config value cty.NullVal(cty.String)`.
 

<br/>

### Attributes

The Terraform plan depends on how attributes are defined in the resource schema:

attribute                            | &nbsp; | Required                        | Optional                        | Computed          
:------------------------------------|--------|:--------------------------------|:--------------------------------|:----------------------------------
             - not in tf state       | &nbsp; |                           &nbsp;|                           &nbsp;|                             &nbsp;
 &nbsp;         -- not in config     | 1      | &lt;error&gt;                   | null                            |&thinsp;`+`&nbsp;(known after apply)
 &nbsp;         -- in config         | 2      |&thinsp;`+`&nbsp;config          |&thinsp;`+`&nbsp;config          | &lt;error&gt;     
             - in tf state           | &nbsp; |                           &nbsp;|                           &nbsp;|                             &nbsp;
 &nbsp;         -- not in tf config  | 3      | &lt;error&gt;                   |&thinsp;`-`&nbsp;state -> null   |&thinsp;` `&nbsp;state 
 &nbsp;         -- in tf config      | &nbsp; |                           &nbsp;|                           &nbsp;|                             &nbsp; 
 &nbsp;&emsp;      > config == state | 4a     |&thinsp;` `&nbsp;state           |&thinsp;` `&nbsp;state           | &lt;error&gt;
 &nbsp;&emsp;      > config != state | 4b     |&thinsp;`~`&nbsp;state -> config |&thinsp;`~`&nbsp;state -> config | &lt;error&gt;     

A `Required` attribute has to be specified in a Terraform configuration.  When not specifying it - see line 1 or 3 - Terraform will throw an error.  When specifying it - see line 2, 4a or 4b - Terraform plans to create it or replace its value in the state with the value of the configuration.

An `Optional` attribute  doesn't have to be specified in a Terraform configuration.  When not specifying it - see line 1 or 3 - Terraform plans to remove it or set its value to `null` in the state.

A `Computed` attribute must not be specified in a Terraform configuration.  When specifying it - see line 2, 4a or 4b - Terraform will throw an error.  When not specifying it - see line 1 - its value will be known after the plan is applied.  However, when this attribute already exists in the Terraform state - see line 3 - Terraform assumes its value will not change.  The Terraform Provider implementation can and should customize this when it expects this attribute's value will change after apply. 

To avoid an `Optional` attribute gets removed, we can make the attribute `Optional` & `Default`
 
attribute                             | &nbsp; | Optional                        | Optional &<br/>Default                
:-------------------------------------|--------|:--------------------------------|:--------------------------------------
             - not in tf state        | &nbsp; |                           &nbsp;|                                 &nbsp; 
 &nbsp;         -- not in tf config   | 1      | null                            |**&thinsp;`+`&nbsp;default** 
 &nbsp;         -- in tf config       | 2      |&thinsp;`+`&nbsp;config          |&thinsp;`+`&nbsp;config                    
             - in tf state            | &nbsp; |                           &nbsp;|                                 &nbsp;  
 &nbsp;         -- not in tf config   | 3      |&thinsp;`-`&nbsp;state -> null   |                                 &nbsp;
 &nbsp;&emsp;      > default == state | 3a     |                           &nbsp;|**&thinsp;` `&nbsp;state**                 
 &nbsp;&emsp;      > default != state | 3b     |                           &nbsp;|**&thinsp;`~`&nbsp;state -> default**       
 &nbsp;         -- in tf config       | &nbsp; |                           &nbsp;|                                 &nbsp;  
 &nbsp;&emsp;      > config == state  | 4a     |&thinsp;` `&nbsp;state           |&thinsp;` `&nbsp;state                 
 &nbsp;&emsp;      > config != state  | 4b     |&thinsp;`~`&nbsp;state -> config |&thinsp;`~`&nbsp;state -> config       

Or we can make the attribute `Optional` & `Computed`.

attribute                            | &nbsp; | Optional                        | Optional &<br/>Computed               | Computed          
:------------------------------------|--------|:--------------------------------|:--------------------------------------|:----------------------------------
             - not in tf state       | &nbsp; |                           &nbsp;|                                 &nbsp;|                             &nbsp; 
 &nbsp;         -- not in tf config  | 1      | null                            |**&thinsp;`+`&nbsp;(known after apply)** |&thinsp;`+`&nbsp;(known after apply)
 &nbsp;         -- in tf config      | 2      |&thinsp;`+`&nbsp;config          |&thinsp;`+`&nbsp;config                | &lt;error&gt;     
             - in tf state           | &nbsp; |                           &nbsp;|                                 &nbsp;|                             &nbsp;  
 &nbsp;         -- not in tf config  | 3      |&thinsp;`-`&nbsp;state -> null   |**&thinsp;` `&nbsp;state**             |&thinsp;` `&nbsp;state 
 &nbsp;         -- in tf config      | &nbsp; |                           &nbsp;|                                 &nbsp;|                             &nbsp;  
 &nbsp;&emsp;      > config == state | 4a     |&thinsp;` `&nbsp;state           |&thinsp;` `&nbsp;state                 | &lt;error&gt;
 &nbsp;&emsp;      > config != state | 4b     |&thinsp;`~`&nbsp;state -> config |&thinsp;`~`&nbsp;state -> config       | &lt;error&gt;

Similar to `Optional` attributes, the value of an `Optional` & `Computed` attribute that is not configured will be known after the plan is applied - see line 1.  However, when this attribute already exists in the Terraform state - see line 3 - Terraform assumes its value will not change.  The Terraform Provider implementation can and should customize this when it expects this attribute's value will change after apply. 

<br/>

### Embedded Resources

Embedded resources behave in much the same way as attributes.  

resource                             | &nbsp; | Required                                             | Optional                               
:------------------------------------|--------|:-----------------------------------------------------|:-------------------------------------------------------
             - not in state          | &nbsp; |                                                &nbsp;|                                                  &nbsp;
 &nbsp;         -- not in config     | 1      | &lt;error&gt;                                        | null                                   
 &nbsp;         -- in config         | 2      |&thinsp;`+`&nbsp;{&nbsp;`+`&nbsp;config... }          |&thinsp;`+`&nbsp;{&nbsp;`+`&nbsp;config... }
             - in state              | &nbsp; |                                                &nbsp;|                                                  &nbsp;
 &nbsp;         -- not in config     | 3      | &lt;error&gt;                                        |&thinsp;`-`&nbsp;{&nbsp;`-`&nbsp;state -> null }         
 &nbsp;         -- in config         | &nbsp; |                                                &nbsp;|                                                  &nbsp;
 &nbsp;&emsp;      > config == state | 4a     |&thinsp;` `&nbsp;{&nbsp;` `&nbsp;state }              |&thinsp;` `&nbsp;{&nbsp;` `&nbsp;state }
 &nbsp;&emsp;      > config != state | 4b     |&thinsp;`~`&nbsp;{&nbsp;`?`&nbsp;state -> config... } |&thinsp;`~`&nbsp;{&nbsp;`?`&nbsp;state -> config... }

> Remark that changes to a resource - see `?` in line 4b - can be `+`, `-`,&thinsp;` `&nbsp;or `~`, depending on the resource's attributes.  

resource attribute                   | &nbsp; | Required                        | Optional                        | Computed          
:------------------------------------|--------|:--------------------------------|:--------------------------------|:----------------------------------
             - not in tf state       | &nbsp; |                           &nbsp;|                           &nbsp;|                             &nbsp;
 &nbsp;         -- not in tf config  | 1      | &lt;error&gt;                   | null                            |&thinsp;`+`&nbsp;(known after apply)
 &nbsp;         -- in tf config      | 2      |&thinsp;`+`&nbsp;config          |&thinsp;`+`&nbsp;config          | &lt;error&gt;     
             - in tf state           | &nbsp; |                           &nbsp;|                           &nbsp;|                             &nbsp;
 &nbsp;         -- not in tf config  | 3      | &lt;error&gt;                   |&thinsp;`-`&nbsp;state -> null   |&thinsp;` `&nbsp;state 
 &nbsp;         -- in tf config      | &nbsp; |                           &nbsp;|                           &nbsp;|                             &nbsp; 
 &nbsp;&emsp;      > config == state | 4a     |&thinsp;` `&nbsp;state           |&thinsp;` `&nbsp;state           | &lt;error&gt;
 &nbsp;&emsp;      > config != state | 4b     |&thinsp;`~`&nbsp;state -> config |&thinsp;`~`&nbsp;state -> config | &lt;error&gt;     

`Required` and `Optional` resources are presented as blocks in the Terraform plan - this is called **"block"** config-mode.  When the resource isn't in the Terraform state or when resource config is not equal to the resource state - see line 2 or 4b - the plan depends on the configuration of the resource's attributes.  The resource's attributes behave in the same way as top-level attributes.

resource                             | &nbsp; | Computed            
:------------------------------------|--------|:----------------------------------------------------------
             - not in state          | &nbsp; |                                                     &nbsp; 
 &nbsp;         -- not in config     | 1      |&thinsp;`+`&nbsp;(known after apply)  
 &nbsp;         -- in config         | 2      | &lt;error&gt;       
             - in state              | &nbsp; |                                                     &nbsp; 
 &nbsp;         -- not in config     | 3      |&thinsp;` `&nbsp;[&nbsp;` `&nbsp;{&nbsp;` `&nbsp;state } ]         
 &nbsp;         -- in config         | &nbsp; |                                                     &nbsp;       
 &nbsp;&emsp;      > config == state | 4a     | &lt;error&gt;
 &nbsp;&emsp;      > config != state | 4b     | &lt;error&gt;

`Computed` resources are presented as a list of resource-blocks in the Terraform plan - this is called **"attribute"** config-mode.  The whole list of resource-blocks behaves like a single top-level attribute.  

> :information_source:  
> Remark that the latest Terraform versions don't officially support embedded `Computed` resources.  Although this does work without problems, it is better to use a schema with a list of `TypeMap`-elements instead of a list of resource-elements.  
> Remark also that it doesn't make sense to have `Required` or `Optional` resource attributes in a `Computed` resource, all attributes will behave like `Computed` attributes - the resource-block is basically "demoted" to a simple map-object (`TypeMap`).  
> 
> However, specifying `Required` or `Optional` resource attributes does make sense for `Optional` & `Computed` resources, as we will discuss below.

Terraform doesn't support embedded `Optional` & `Default` resources yet.  There is an [issue with enhancement label](https://github.com/hashicorp/terraform-plugin-sdk/issues/142) for this.

To avoid an `Optional` resource gets removed, we can make the resource `Optional` & `Computed`.

resource                             | &nbsp; | Optional                                             | Optional &<br/>Computed                 
:------------------------------------|--------|:-----------------------------------------------------|:----------------------------------------------------------
             - not in tf state       | &nbsp; |                                                &nbsp;|                                                     &nbsp;
 &nbsp;         -- not in tf config  | 1      | null                                                 |**&thinsp;`+`&nbsp;{&nbsp;`+`&nbsp;(known after apply) }** 
 &nbsp;         -- in tf config      | 2      |&thinsp;`+`&nbsp;{&nbsp;`+`&nbsp;config... }          |&thinsp;`+`&nbsp;{&nbsp;`+`&nbsp;config... }           
             - in tf state           | &nbsp; |                                                &nbsp;|                                                     &nbsp;
 &nbsp;         -- not in tf config  | 3      |&thinsp;`-`&nbsp;{&nbsp;`-`&nbsp;state -> null }      |**&thinsp;` `&nbsp;{&nbsp;` `&nbsp;state }**           
 &nbsp;         -- in tf config      | &nbsp; |                                                &nbsp;|                                                     &nbsp;
 &nbsp;&emsp;      > config == state | 4a     |&thinsp;` `&nbsp;{&nbsp;` `&nbsp;state }              |&thinsp;` `&nbsp;{&nbsp;` `&nbsp;state }               
 &nbsp;&emsp;      > config != state | 4b     |&thinsp;`~`&nbsp;{&nbsp;`?`&nbsp;state -> config... } |&thinsp;`~`&nbsp;{&nbsp;`?`&nbsp;state -> config... }  

By default, an `Optional` & `Computed` resource uses "block" config-mode, as shown above.  However, this can be changed to "attribute" config-mode by setting `ConfigMode: schema.SchemaConfigModeAttr,` in the resource's schema.  This will also slightly change the behaviour of `Optional` resource attributes.

resource                             | &nbsp; | Optional &<br/>Computed<br/>using block config mode   | Optional &<br/>Computed<br/>using attribute config mode                 
:------------------------------------|--------|:------------------------------------------------------|:---------------------------------------------------------------------------
             - not in tf state       | &nbsp; |                                                 &nbsp;|                                                                      &nbsp;
 &nbsp;         -- not in tf config  | 1      |&thinsp;`+`&nbsp;{&nbsp;`+`&nbsp;(known after apply) } |**&thinsp;`+`&nbsp;(known after apply)**
 &nbsp;         -- in tf config      | 2      |&thinsp;`+`&nbsp;{&nbsp;`+`&nbsp;config... }           |**&thinsp;`+`&nbsp;[&nbsp;`+`&nbsp;{&nbsp;`+`&nbsp;config... } ]**
             - in tf state           | &nbsp; |                                                 &nbsp;|                                                                      &nbsp;
 &nbsp;         -- not in tf config  | 3      |&thinsp;` `&nbsp;{&nbsp;` `&nbsp;state }               |**&thinsp;` `&nbsp;[&nbsp;` `&nbsp;{&nbsp;` `&nbsp;state } ]**
 &nbsp;         -- in tf config      | &nbsp; |                                                 &nbsp;|                                                                      &nbsp;
 &nbsp;&emsp;      > config == state | 4a     |&thinsp;` `&nbsp;{&nbsp;` `&nbsp;state }               |**&thinsp;` `&nbsp;[&nbsp;` `&nbsp;{&nbsp;` `&nbsp;state } ]**               
 &nbsp;&emsp;      > config != state | 4b     |&thinsp;`~`&nbsp;{&nbsp;`?`&nbsp;state -> config... }  |**&thinsp;`~`&nbsp;[&nbsp;`?`&nbsp;{&nbsp;`?`&nbsp;state -> config... } ]**  

resource attribute                   | &nbsp; | Optional<br/>using block config mode | Optional<br/>using attribute config mode 
:------------------------------------|--------|:-------------------------------------|:-----------------------------------------
             - not in tf state       | &nbsp; |                                &nbsp;|                                    &nbsp; 
 &nbsp;         -- not in tf config  | 1      | null                                 |                                    &nbsp; 
 &nbsp;&emsp;      >> block == null  | 1a     |                                &nbsp;| null                  
 &nbsp;&emsp;      >> block != null  | 1b     |                                &nbsp;|**&thinsp;`+`&nbsp;null**     
 &nbsp;         -- in tf config      | 2      |&thinsp;`+`&nbsp;config               |&thinsp;`+`&nbsp;config                 
             - in terraform state    | &nbsp; |                                &nbsp;|                                    &nbsp; 
 &nbsp;         -- not in tf config  | 3      |&thinsp;`-`&nbsp;state -> null        |                                    &nbsp;
 &nbsp;&emsp;      >> block == null  | 3a     |                                &nbsp;|&thinsp;`-`&nbsp;state -> null                  
 &nbsp;&emsp;      >> block != null  | 3b     |                                &nbsp;|**&thinsp;` `&nbsp;state**     
 &nbsp;         -- in tf config      | &nbsp; |                                &nbsp;|                                    &nbsp;
 &nbsp;&emsp;      > config == state | 4a     |&thinsp;` `&nbsp;state                |&thinsp;` `&nbsp;state                  
 &nbsp;&emsp;      > config != state | 4b     |&thinsp;`~`&nbsp;state -> config      |&thinsp;`~`&nbsp;state -> config  

> Remark that "&thinsp;`+`&nbsp;null" in this table means that the plan will present the zeroed value for the attribute.  For a string this is `""`, for an integer this is `0`, for a boolean this is `false` and for an aggregate this is `null`.     

> Remark also that for line 3a, Terraform currently reports "&thinsp;`-`&nbsp;state" instead of "&thinsp;`-`&nbsp;state -> null", but this must be a bug since this is not in line with what is usually reported when destroying resources.

This choice of config mode is particularly important when configuring `embedded_resource = []`.  It allows to make a distinction between absence of resources and an empty list of resources.  

- When setting `ConfigMode: schema.SchemaConfigModeBlock,` (default) in the resource's schema, by default `embedded_resource = []` cannot be used for embedded resources.  Terraform will throw an error.

- When setting `ConfigMode: schema.SchemaConfigModeAttr,` in the resource's schema, and when changing the config to `embedded_resource = []`, Terraform will create an empty list of resource-blocks or change to an empty list of resource-blocks - see lines 2 & 1a or 4b & 3a.  

<br/>

#### Notes On Config Mode

From the [schema documentation](https://godoc.org/github.com/hashicorp/terraform-plugin-sdk/helper/schema#Schema) / `"ConfigMode SchemaConfigMode"`:

> ConfigMode allows for overriding the default behaviors for mapping schema entries onto configuration constructs.
> 
> By default, the `Elem` field is used to choose whether a particular schema is represented in configuration as an attribute or as a nested block - an embedded resource.  If `Elem` is a `*schema.Resource` then it's a block and it's an attribute otherwise.
>
> If `Elem` is a `*schema.Resource` then setting `ConfigMode` to `SchemaConfigModeAttr` will force it to be represented in configuration as an attribute, which means that the `Computed` flag can be used to provide default *[edit: computed]* elements when the argument isn't set at all, while still allowing the user to force zero elements by explicitly assigning an empty list.
>
> When `Computed` is set without `Optional`, the attribute is not settable in configuration at all and so `SchemaConfigModeAttr` is the automatic behavior, and `SchemaConfigModeBlock` is not permitted.

Some more info:

- [Attributes as Blocks](https://www.terraform.io/docs/configuration/attr-as-blocks.html)
- [Computed Resource Attributes](https://www.terraform.io/docs/extend/terraform-0.12-compatibility.html#computed-resource-attributes)

<br/>

### Trying It Out

I prepared a small package for a provider, in case you want to play with this.  For embedded resources, you may want to change the schema-options in `/abc/resource_abc_xyz.go`

To build the provider:

1. Create a repository, for instance called `terraform-provider-abc`

2. Download the content from the `terraform-provider-abc` in [the `abc` package](/assets/2020-02-27-the-terraform-plan/terraform-provider-abc.zip) into your repository

3. Assuming you have `go` installed and properly configured,  
   in the `terraform-provider-abc` directory, 

    1. run `go mod tidy`  
    2. run `go build -o "$env:APPDATA\terraform.d\plugins"` (on Windows using Powershell)  
       or `go build -o "%APPDATA%\terraform.d\plugins"` (on Windows using CMD)  
       or `go build -o ~/.terraform.d/plugins` (on Linux)  

To run the provider:

1. Assuming you have `terraform` installed and properly configured,  
   in the `terraform-provider-abc/examples` directory, 

    1. run `terraform init`
    2. run `terraform plan`
    2. run `terraform apply`
    2. run `terraform destroy`

<br/>

---

### Related Posts

- [The Terraform Resource Lifecycle]({% post_url 2020-02-15-the-terraform-resource-lifecycle %})

<br/>

---