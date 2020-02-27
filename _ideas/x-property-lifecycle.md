## Property Lifecycle

An overview of the "diff-indications" in a terraform plan.  `CustomizeDiff` functions can change this default behaviour. 

### Attributes

attribute                                              | Required                       | Optional                       | Optional & Default              | Computed            | Optional & Computed
:------------------------------------------------------|:-------------------------------|:-------------------------------|:--------------------------------|:--------------------|:-------------------------------
 &nbsp;               - not in terraform state         |                          &nbsp;|                          &nbsp;|                           &nbsp;|               &nbsp;|                          &nbsp; 
 &nbsp; &emsp;           -- not in terraform config    | &lt;error&gt;                  | --- <br/> (null)               | add <br/> (default)             | add <br/> (unknown) | add <br/> (unknown)
 &nbsp; &emsp;           -- in terraform config        | add <br/> (config)             | add <br/> (config)             | add <br/> (config)              | &lt;error&gt;       | add <br/> (config)
 &nbsp;               - in terraform state             |                          &nbsp;|                          &nbsp;|                           &nbsp;|               &nbsp;|                          &nbsp; 
 &nbsp; &emsp;           -- not in terraform config    | &lt;error&gt;                  | remove <br/> (state -> null)   |                           &nbsp;| --- <br/> (state)*1 | --- <br/> (state)*1
 &nbsp; &emsp; &emsp;        > default same as state   |                          &nbsp;|                          &nbsp;| --- <br/> (state)               |               &nbsp;|                          &nbsp;
 &nbsp; &emsp; &emsp;        > default diff from state |                          &nbsp;|                          &nbsp;| update <br/> (state -> default) |               &nbsp;|                          &nbsp;
 &nbsp; &emsp;           -- in terraform config        |                          &nbsp;|                          &nbsp;|                           &nbsp;| &lt;error&gt;       |                          &nbsp; 
 &nbsp; &emsp; &emsp;        > config same as state    | --- <br/> (state)              | --- <br/> (state)              | --- <br/> (state)               |               &nbsp;| --- <br/> (state)
 &nbsp; &emsp; &emsp;        > config diff from state  | update <br/> (state -> config) | update <br/> (state -> config) | update <br/> (state -> config)  |               &nbsp;| update <br/> (state -> config)

`--- (null)`: No operation planned.  Attribute doesn't appear in terraform plan.  
`--- (state)`: No operation planned.  Attribute appears with state value in terraform plan.  
`add (config)`: Plan is to add attribute to terraform state with config value if config value is not `""`, otherwise fall back to the "not in terraform config" row.
`add (default)`: Plan is to add attribute to terraform state with default value if default value is not `""`, otherwise fall back to the "Optional" column.
`add (unknown)`: Plan is to add attribute to terraform state with currently unknown computed value.
`update (state -> config)`: Plan is to update attribute in terraform state with config value if config value is not `""`, otherwise fall back to the "not in terraform config" row.
`update (state -> default)`: Plan is to update attribute in terraform state with default value if default value is not `""`, otherwise fall back to the " "Optional" column.
`update (state -> unknown)`: Plan is to update attribute in terraform state with currently unknown computed value.  (not default terraform behaviour - see `*1`)
`remove <br/> (state -> null)`: Plan is to remove attribute from terraform state.

`*1`: Use `CustomizeDiff` with `SetNewComputed` to change to plan for computed attributes from `--- (state)` to `update (state -> unknown)`, in order to avoid possible issues with downstream operations, and avoid resulting legacy plugin SDK warnings in terraform log.

<br/>

### Nested resources

resource                                               | Required                       | Optional                       | Optional & Default              | Computed            | Optional & Computed
:------------------------------------------------------|:-------------------------------|:-------------------------------|:--------------------------------|:--------------------|:-------------------------------
 &nbsp;               - not in terraform state         |                          &nbsp;|                          &nbsp;|                           &nbsp;|               &nbsp;|                          &nbsp; 
 &nbsp; &emsp;           -- not in terraform config    | &lt;error&gt;                  | --- <br/> (null)               | add <br/> (default)             | add <br/> (unknown) | add <br/> (unknown)
 &nbsp; &emsp;           -- in terraform config        | add                            | add                            | add                             | &lt;error&gt;       | add
 &nbsp;               - in terraform state             |                          &nbsp;|                          &nbsp;|                           &nbsp;|               &nbsp;|                          &nbsp; 
 &nbsp; &emsp;           -- not in terraform config    | &lt;error&gt;                  | remove <br/> (-> null)         |                           &nbsp;| ---                 | ---
 &nbsp; &emsp; &emsp;        > default same as state   |                          &nbsp;|                          &nbsp;| ---                             |               &nbsp;|                          &nbsp;
 &nbsp; &emsp; &emsp;        > default diff from state |                          &nbsp;|                          &nbsp;| update <br/> (-> default)       |               &nbsp;|                          &nbsp;
 &nbsp; &emsp;           -- in terraform config        |                          &nbsp;|                          &nbsp;|                           &nbsp;| &lt;error&gt;       |                          &nbsp; 
 &nbsp; &emsp; &emsp;        > attrs same as state     | ---                            | ---                            | ---                             |               &nbsp;| ---
 &nbsp; &emsp; &emsp;        > attrs diff from state   | update                         | update                         | update                          |               &nbsp;| update

`--- (null)`: No operation planned.  Resource doesn't appear in terraform plan.  
`---`: No operation planned.  Resource appears in terraform plan.  
`add`: Plan is to add resource to terraform state.  The plan for the resource attributes are defined in next table.
`add (default)`: Plan is to add resource to terraform state with default attributes and values.
`add (unknown)`: Plan is to add resource to terraform state with currently unknown attributes and values.
`update`: Plan is to update resource in terraform state.  The plan for the resource attributes are defined in next table.
`update (-> default)`: Plan is to update resource in terraform state with default attributes and values.
`remove <br/> (-> null)`: Plan is to remove resource and all it's attributes from terraform state.

resource attribute                                     | Required                       | Optional                       | Optional & Default              | Computed            | Optional & Computed
:------------------------------------------------------|:-------------------------------|:-------------------------------|:--------------------------------|:--------------------|:-------------------------------
 &nbsp;               - not in terraform state         |                          &nbsp;|                          &nbsp;|                           &nbsp;|               &nbsp;|                          &nbsp; 
 &nbsp; &emsp;           -- not in terraform config    | &lt;error&gt;                  | --- <br/> (null)               | add <br/> (default)             | add <br/> (unknown) | add <br/> (unknown)
 &nbsp; &emsp;           -- in terraform config        | add <br/> (config)             | add <br/> (config)             | add <br/> (config)              | &lt;error&gt;       | add <br/> (config)
 &nbsp;               - in terraform state             |                          &nbsp;|                          &nbsp;|                           &nbsp;|               &nbsp;|                          &nbsp; 
 &nbsp; &emsp;           -- not in terraform config    | &lt;error&gt;                  | remove <br/> (state -> null)   |                           &nbsp;| --- <br/> (state)** | --- <br/> (state)**
 &nbsp; &emsp; &emsp;        > default same as state   |                          &nbsp;|                          &nbsp;| --- <br/> (state)               |               &nbsp;|                          &nbsp;
 &nbsp; &emsp; &emsp;        > default diff from state |                          &nbsp;|                          &nbsp;| update <br/> (state -> default) |               &nbsp;|                          &nbsp;
 &nbsp; &emsp;           -- in terraform config        |                          &nbsp;|                          &nbsp;|                           &nbsp;| &lt;error&gt;       |                          &nbsp; 
 &nbsp; &emsp; &emsp;        > config same as state    | --- <br/> (state)              | --- <br/> (state)              | --- <br/> (state)               |               &nbsp;| --- <br/> (state)
 &nbsp; &emsp; &emsp;        > config diff from state  | update <br/> (state -> config) | update <br/> (state -> config) | update <br/> (state -> config)  |               &nbsp;| update <br/> (state -> config)

`--- (null)`: No operation planned.  Attribute doesn't appear in terraform plan.  
`--- (state)`: No operation planned.  Attribute appears with state value in terraform plan.  
`add (config)`: Plan is to add attribute to terraform state with config value if config value is not `""`, otherwise fall back to the "not in terraform config" row.
`add (default)`: Plan is to add attribute to terraform state with default value if default value is not `""`, otherwise fall back to the "Optional" column.
`add (unknown)`: Plan is to add attribute to terraform state with currently unknown computed value.
`update (state -> config)`: Plan is to update attribute in terraform state with config value if config value is not `""`, otherwise fall back to the "not in terraform config" row.
`update (state -> default)`: Plan is to update attribute in terraform state with default value if default value is not `""`, otherwise fall back to the " "Optional" column.
`update (state -> unknown)`: Plan is to update attribute in terraform state with currently unknown computed value.  (not default terraform behaviour - see `*1`)
`remove <br/> (state -> null)`: Plan is to remove attribute from terraform state.

`*1`: Use `CustomizeDiff` with `SetNewComputed` to change to plan for computed attributes from `--- (state)` to `update (state -> unknown)`, in order to avoid possible issues with downstream operations, and avoid resulting legacy plugin SDK warnings in terraform log.

<br/>

### Nested resources, using attribute config mode

> :warning:  
> All resources nested inside a nested resource that is using attribute config mode, also need to use the attribute config mode

resource                                               | Required                       | Optional                       | Optional & Default              | Computed            | Optional & Computed
:------------------------------------------------------|:-------------------------------|:-------------------------------|:--------------------------------|:--------------------|:-------------------------------
 &nbsp;               - not in terraform state         |                          &nbsp;|                          &nbsp;|                           &nbsp;|               &nbsp;|                          &nbsp; 
 &nbsp; &emsp;           -- not in terraform config    | &lt;error&gt;                  | --- <br/> (null)               | add <br/> (default)             | add <br/> (unknown) | add <br/> (unknown)
 &nbsp; &emsp;           -- in terraform config        | add                            | add                            | add                             | &lt;error&gt;       | add
 &nbsp;               - in terraform state             |                          &nbsp;|                          &nbsp;|                           &nbsp;|               &nbsp;|                          &nbsp; 
 &nbsp; &emsp;           -- not in terraform config    | &lt;error&gt;                  | **---**                        |                           &nbsp;| ---                 | ---
 &nbsp; &emsp; &emsp;        > default same as state   |                          &nbsp;|                          &nbsp;| ---                             |               &nbsp;|                          &nbsp;
 &nbsp; &emsp; &emsp;        > default diff from state |                          &nbsp;|                          &nbsp;| update <br/> (-> default)       |               &nbsp;|                          &nbsp;
 &nbsp; &emsp;           -- in terraform config        |                          &nbsp;|                          &nbsp;|                           &nbsp;| &lt;error&gt;       |                          &nbsp; 
 &nbsp; &emsp; &emsp;        > attrs same as state     | ---                            | ---                            | ---                             |               &nbsp;| ---
 &nbsp; &emsp; &emsp;        > attrs diff from state   | update                         | update                         | update                          |               &nbsp;| update


resource attribute                                        | Required                       | Optional                       | Optional & Default              | Computed            | Optional & Computed
:---------------------------------------------------------|:-------------------------------|:-------------------------------|:--------------------------------|:--------------------|:-------------------------------
 &nbsp;               - not in terraform state            |                          &nbsp;|                          &nbsp;|                           &nbsp;|               &nbsp;|                          &nbsp; 
 &nbsp; &emsp;           -- not in terraform config       | &lt;error&gt;                  |                          &nbsp;| add <br/> (default)             | add <br/> (unknown) | add <br/> (unknown)
 &nbsp; &emsp; &emsp; &emsp;    >> resource not in config |                          &nbsp;| --- <br/> (null)               |                           &nbsp;|               &nbsp;|                          &nbsp;
 &nbsp; &emsp; &emsp; &emsp;    >> resource in config     |                          &nbsp;| **add <br/> (null)**           |                           &nbsp;|               &nbsp;|                          &nbsp;
 &nbsp; &emsp;           -- in terraform config           | add <br/> (config)             | add <br/> (config)             | add <br/> (config)              | &lt;error&gt;       | add <br/> (config)
 &nbsp;               - in terraform state                |                          &nbsp;|                          &nbsp;|                           &nbsp;|               &nbsp;|                          &nbsp; 
 &nbsp; &emsp;           -- not in terraform config       | &lt;error&gt;                  |                          &nbsp;|                           &nbsp;| --- <br/> (state)** | --- <br/> (state)**
 &nbsp; &emsp; &emsp; &emsp;    >> resource not in config |                          &nbsp;| remove <br/> (state -> null)   |                           &nbsp;|               &nbsp;|                          &nbsp;
 &nbsp; &emsp; &emsp; &emsp;    >> resource in config     |                          &nbsp;| **--- <br/> (state)**          |                           &nbsp;|               &nbsp;|                          &nbsp;
 &nbsp; &emsp; &emsp;        > default same as state      |                          &nbsp;|                          &nbsp;| --- <br/> (state)               |               &nbsp;|                          &nbsp;
 &nbsp; &emsp; &emsp;        > default diff from state    |                          &nbsp;|                          &nbsp;| update <br/> (state -> default) |               &nbsp;|                          &nbsp;
 &nbsp; &emsp;           -- in terraform config           |                          &nbsp;|                          &nbsp;|                           &nbsp;| &lt;error&gt;       |                          &nbsp; 
 &nbsp; &emsp; &emsp;        > config same as state       | --- <br/> (state)              | --- <br/> (state)              | --- <br/> (state)               |               &nbsp;| --- <br/> (state)
 &nbsp; &emsp; &emsp;        > config diff from state     | update <br/> (state -> config) | update <br/> (state -> config) | update <br/> (state -> config)  |               &nbsp;| update <br/> (state -> config)

<br/>

### String attributes needing `""` as a valid value

__Problem__: 

Terraform interprets the `""` value for a string attribute similar to a `null`, as if the attribute is not configured.

Consequences are:

- When setting a required string attribute to `""` in the terraform config, terraform throws an error 
- When setting an optional string attribute to `""` in the terraform config, terraform diff doesn't pick this up as a change 
- When changing an optional string attribute from `"something"` to `""` in the terraform config, terraform diff does pick this up as a "remove"-change.
- When setting an optional computed string attribute to `""` in the terraform config, terraform diff does pick this up as an "unknown"-change.
- When changing an optional computed string attribute from `"something"` to `""` in the terraform config, terraform diff doesn't pick this up as a change.

> :bulb:  
> This is only a problem for string attributes and `""`, no problem for other attributes and their zero value

Terraform says this is working as intended.  However these semantics a remnant from the old terraform versions when `null` was not an accepted value, and hopefully will be corrected in a future version.    

__Workaround__: 

1. Use a special string like `"<empty>"` in the configuration.
 
   Alternatively, to work around these terraform semantics, use a "StateFunc" in the schema to replace the `""` value with a special string like `"<empty>"`, so the special string is used in the terraform plan and state.  Disadvantage is that you will get a legacy plugin SDK warning `planned value cty.StringVal("<empty>") does not match config value cty.StringVal("")`, possibly complicating downstream interpolation, but harmless in most cases.  This may perhaps cause problems in future terraform versions depending on the semantics of terraform's new plugin SDK.

   ```golang
   func StateAcceptEmptyString() schema.SchemaStateFunc {
       return func(val interface{}) string {
           v := val.(string)
           if v == "" {
               return "<empty>"
           } else {
               return v
           }
       }
   }
   ``` 

2. When applying the plan and reading the attribute, change the value `""` from the resource's API to the special string.
    
3. When applying the plan and creating the attribute, change this special string back to `""` for the resource's API.

4. When applying the plan and updating the attribute, change this special string back to `""` for the resource's API.
